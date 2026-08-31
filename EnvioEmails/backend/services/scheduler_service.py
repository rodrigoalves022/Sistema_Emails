import asyncio
import json
from datetime import datetime
from database import get_db, log_auditoria
from services.smtp_service import send_smtp_email
from services.template_service import get_template_by_id_or_key, render_template_email, replace_template_variables
from services.backup_types import normalizar_tipo_backup, TIPOS_BACKUP_CCO_AUTOMATICO

_scheduler_running = False


def execute_agendamento(agendamento_id: int) -> tuple[bool, str | None]:
    """Executa o envio imediato de um agendamento específico."""
    with get_db() as db:
        ag = db.execute("""
            SELECT a.*, e.nome as empresa_nome, e.responsavel_principal
            FROM agendamentos a
            JOIN empresas e ON a.empresa_id = e.id
            WHERE a.id = ?
        """, (agendamento_id,)).fetchone()

        if not ag:
            return False, "Agendamento não encontrado."

        ag = dict(ag)
        empresa_id = ag["empresa_id"]
        empresa_nome = ag["empresa_nome"]
        responsavel = ag["responsavel_principal"] or empresa_nome
        tipo_backup = ag.get("tipo_backup") or "semanal"
        tipo_backup_norm = normalizar_tipo_backup(tipo_backup)
        tipo_email = ag.get("tipo_email", "rotina")

        # Busca contatos e emails da empresa
        emails_db = db.execute("SELECT endereco, tipo FROM emails WHERE empresa_id = ? AND ativo = 1", (empresa_id,)).fetchall()
        
        # Destinatário principal e BCCs
        to_email = ag.get("destinatario_principal")
        if not to_email:
            # Pega o primeiro principal cadastrado
            for em in emails_db:
                if em["tipo"] == "principal":
                    to_email = em["endereco"]
                    break
            if not to_email and emails_db:
                to_email = emails_db[0]["endereco"]

        # Parse BCCs
        bcc_list = []
        if ag.get("bcc_emails"):
            bcc_list = [b.strip() for b in ag["bcc_emails"].split(",") if b.strip()]
        elif tipo_email == "inicio_rotina" and tipo_backup_norm in TIPOS_BACKUP_CCO_AUTOMATICO:
            # Cópia automática (Cc visível): só para informativo de início de rotina
            # Semanal/Mensal/Anual. Vai em Cc real (não BCC oculto) pois o disparo é
            # sempre isolado por empresa — ver send_smtp_email.
            bcc_list = [em["endereco"] for em in emails_db if em["endereco"] != to_email]

        if not to_email:
            err = "Nenhum e-mail de destinatário disponível para esta empresa."
            db.execute("UPDATE agendamentos SET status = 'falhou', erro = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (err, agendamento_id))
            return False, err

        # Contexto de variáveis
        context = {
            "empresa": empresa_nome,
            "responsavel": responsavel,
            "tipo_backup": tipo_backup.capitalize() if tipo_backup else "Semanal",
            "data": datetime.now().strftime("%d/%m/%Y"),
            "horario": ag.get("datetime_previsto", "").split(" ")[-1][:5] or "16:30",
            "contato": responsavel,
            "nome_cliente": empresa_nome,
        }

        # Monta assunto e HTML
        if ag.get("custom_html"):
            assunto = replace_template_variables(ag.get("custom_assunto", f"Backup {tipo_backup} - {empresa_nome}"), context)
            html = replace_template_variables(ag["custom_html"], context)
        elif ag.get("template_id"):
            tpl = get_template_by_id_or_key(ag["template_id"])
            if not tpl:
                err = f"Template #{ag['template_id']} não encontrado."
                db.execute("UPDATE agendamentos SET status = 'falhou', erro = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (err, agendamento_id))
                return False, err
            assunto, html = render_template_email(tpl, context, preview_mode=False)
            if ag.get("custom_assunto"):
                assunto = replace_template_variables(ag["custom_assunto"], context)
        else:
            assunto = replace_template_variables(ag.get("custom_assunto", f"Comunicado de Backup - {empresa_nome}"), context)
            html = f"<p>Prezado(a) {responsavel},</p><p>Comunicamos a rotina de backup {tipo_backup} para a empresa {empresa_nome}.</p>"

        # Envia via SMTP
        sucesso, erro = send_smtp_email(to_email, assunto, html, bcc_list)

        status_final = "enviado" if sucesso else "falhou"
        db.execute("""
            UPDATE agendamentos
            SET status = ?, erro = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status_final, erro, agendamento_id))

        # Registra em emails_enviados
        db.execute("""
            INSERT INTO emails_enviados (
                agendamento_id, empresa_id, tipo_backup, tipo_email, template_id,
                assunto, destinatario_principal, bcc_emails, status, erro, html_content, data_envio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            agendamento_id,
            empresa_id,
            tipo_backup_norm or tipo_backup,
            tipo_email,
            ag.get("template_id"),
            assunto,
            to_email,
            ", ".join(bcc_list),
            "sucesso" if sucesso else "erro",
            erro,
            html,
        ))

        # Se houver falha ativa relacionada a essa empresa, atualiza data do último envio
        if sucesso:
            db.execute("""
                UPDATE falhas
                SET ultimo_email_enviado = CURRENT_TIMESTAMP
                WHERE empresa_id = ? AND status = 'em_falha'
            """, (empresa_id,))

        log_auditoria(
            "AGENDAMENTOS",
            agendamento_id,
            "ENVIO_AGENDADO_SUCESSO" if sucesso else "ENVIO_AGENDADO_ERRO",
            f"Envio para {empresa_nome} ({to_email}) - Status: {status_final}" + (f" - Erro: {erro}" if erro else ""),
            db=db,
        )

        return sucesso, erro


async def scheduler_loop():
    """Worker em background que processa agendamentos com datetime_previsto <= agora."""
    global _scheduler_running
    _scheduler_running = True
    print("[SCHEDULER] Iniciado motor de envio automático de e-mails em background.")

    while _scheduler_running:
        try:
            agendamentos_pendentes = []
            with get_db() as db:
                agendamentos_pendentes = db.execute("""
                    SELECT id FROM agendamentos
                    WHERE status = 'agendado'
                      AND datetime_previsto <= datetime('now', 'localtime')
                    ORDER BY datetime_previsto ASC
                    LIMIT 20
                """).fetchall()

            for row in agendamentos_pendentes:
                ag_id = row["id"]
                # Marca como processando para não duplicar
                with get_db() as db:
                    db.execute("UPDATE agendamentos SET status = 'processando' WHERE id = ?", (ag_id,))
                
                # Executa envio
                execute_agendamento(ag_id)
                await asyncio.sleep(0.5)

        except Exception as e:
            print(f"[SCHEDULER ERROR] Erro no loop de agendamento: {e}")

        await asyncio.sleep(30)
