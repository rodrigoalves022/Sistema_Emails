from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db, log_auditoria
from services.smtp_service import send_smtp_email
from services.template_service import get_template_by_id_or_key, render_template_email, replace_template_variables
from services.backup_types import normalizar_tipo_backup

router = APIRouter(prefix="/api/falhas", tags=["Falhas de Backup"])


class FalhaCreate(BaseModel):
    empresa_id: int
    tipo_backup: str = "Semanal"
    motivo: str = "Não troca do disco"
    descricao: str | None = None


class DispararFalhaPayload(BaseModel):
    empresa_id: int
    tipo_backup: str = "Semanal"
    motivo: str = "Não troca do disco"
    template_id: int | None = None
    custom_assunto: str | None = None
    custom_html: str | None = None
    destinatario_principal: str | None = None
    bcc_emails: list[str] = []
    agendar: bool = False
    datetime_previsto: str | None = None


@router.get("")
def list_falhas(status: str | None = "em_falha"):
    with get_db() as db:
        query = """
            SELECT 
                f.*,
                e.nome as empresa_nome,
                e.responsavel_principal,
                (SELECT endereco FROM emails WHERE empresa_id = e.id AND tipo = 'principal' AND ativo = 1 LIMIT 1) as email_principal,
                (SELECT datetime_previsto FROM agendamentos WHERE empresa_id = e.id AND status = 'agendado' ORDER BY datetime_previsto ASC LIMIT 1) as proximo_email_agendado
            FROM falhas f
            JOIN empresas e ON f.empresa_id = e.id
            WHERE 1=1
        """
        params = []
        if status and status != "todas":
            query += " AND f.status = ?"
            params.append(status)

        query += " ORDER BY f.data_registro DESC"
        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]


@router.post("")
def register_falha(data: FalhaCreate):
    tipo_backup_norm = normalizar_tipo_backup(data.tipo_backup)
    with get_db() as db:
        emp = db.execute("SELECT nome FROM empresas WHERE id = ?", (data.empresa_id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        # Ativa flag na empresa
        db.execute("UPDATE empresas SET backup_em_falha = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (data.empresa_id,))

        cursor = db.execute("""
            INSERT INTO falhas (empresa_id, tipo_backup, motivo, descricao, status, data_registro)
            VALUES (?, ?, ?, ?, 'em_falha', CURRENT_TIMESTAMP)
        """, (data.empresa_id, tipo_backup_norm, data.motivo, data.descricao))
        falha_id = cursor.lastrowid

        log_auditoria("FALHAS", falha_id, "REGISTRAR_FALHA", f"Falha registrada para {emp['nome']}: {data.motivo} ({tipo_backup_norm})", db=db)
        return {"sucesso": True, "id": falha_id}


@router.post("/{id}/resolver")
def resolve_falha(id: int):
    with get_db() as db:
        falha = db.execute("SELECT * FROM falhas WHERE id = ?", (id,)).fetchone()
        if not falha:
            raise HTTPException(status_code=404, detail="Falha não encontrada.")

        empresa_id = falha["empresa_id"]
        db.execute("UPDATE falhas SET status = 'resolvida', data_resolucao = CURRENT_TIMESTAMP WHERE id = ?", (id,))

        # Se não houver mais falhas abertas para a empresa, desativa flag
        outras = db.execute("SELECT COUNT(*) as cnt FROM falhas WHERE empresa_id = ? AND status = 'em_falha'", (empresa_id,)).fetchone()["cnt"]
        if outras == 0:
            db.execute("UPDATE empresas SET backup_em_falha = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (empresa_id,))

        log_auditoria("FALHAS", id, "RESOLVER_FALHA", f"Falha #{id} resolvida.", db=db)
        return {"sucesso": True, "mensagem": "Falha marcada como resolvida."}


@router.post("/disparar-comunicado")
def disparar_comunicado_falha(payload: DispararFalhaPayload):
    with get_db() as db:
        emp = db.execute("SELECT * FROM empresas WHERE id = ?", (payload.empresa_id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        empresa_nome = emp["nome"]
        responsavel = emp["responsavel_principal"] or empresa_nome
        tipo_backup = normalizar_tipo_backup(payload.tipo_backup)

        # Destinatário
        to_email = payload.destinatario_principal
        if not to_email:
            em_row = db.execute("SELECT endereco FROM emails WHERE empresa_id = ? AND tipo = 'principal' AND ativo = 1 LIMIT 1", (payload.empresa_id,)).fetchone()
            to_email = em_row["endereco"] if em_row else None

        if not to_email:
            raise HTTPException(status_code=400, detail="Nenhum e-mail de destinatário disponível para esta empresa.")

        # Cópia (Cc) visível: comunicado de falha nunca é "início de rotina", então a
        # cópia automática (regra restrita a inicio_rotina + semanal/mensal/anual) nunca
        # se aplica aqui. Só entra em Cc se o operador informar explicitamente.
        bcc_list = payload.bcc_emails or []

        context = {
            "empresa": empresa_nome,
            "responsavel": responsavel,
            "tipo_backup": tipo_backup,
            "motivo": payload.motivo,
            "contato": responsavel,
            "nome_cliente": empresa_nome,
        }

        # Renderiza HTML
        if payload.custom_html:
            assunto = replace_template_variables(payload.custom_assunto or f"Alerta de Falha de Backup - {empresa_nome}", context)
            html = replace_template_variables(payload.custom_html, context)
        elif payload.template_id:
            tpl = get_template_by_id_or_key(payload.template_id)
            if not tpl:
                raise HTTPException(status_code=404, detail="Template não encontrado.")
            assunto, html = render_template_email(tpl, context, preview_mode=False)
            if payload.custom_assunto:
                assunto = replace_template_variables(payload.custom_assunto, context)
        else:
            assunto = payload.custom_assunto or f"Falha na Rotina de Backup {tipo_backup} - {empresa_nome}"
            html = f"""
            <p>Prezado(a) {responsavel},</p>
            <p>Informamos que o backup <strong>{tipo_backup}</strong> da empresa <strong>{empresa_nome}</strong> não foi concluído devido a: <strong>{payload.motivo}</strong>.</p>
            <p>Solicitamos a verificação imediata do ambiente para restabelecimento da rotina.</p>
            """

        # Se for agendamento
        if payload.agendar and payload.datetime_previsto:
            cursor = db.execute("""
                INSERT INTO agendamentos (
                    empresa_id, tipo_backup, tipo_email, template_id, custom_assunto, custom_html,
                    datetime_previsto, destinatario_principal, bcc_emails, status
                ) VALUES (?, ?, 'falha', ?, ?, ?, ?, ?, ?, 'agendado')
            """, (
                payload.empresa_id, tipo_backup, payload.template_id, payload.custom_assunto, payload.custom_html,
                payload.datetime_previsto, to_email, ", ".join(bcc_list)
            ))
            ag_id = cursor.lastrowid
            log_auditoria("AGENDAMENTOS", ag_id, "AGENDAR_COMUNICADO_FALHA", f"Comunicado de falha agendado para {empresa_nome} em {payload.datetime_previsto}", db=db)
            return {"sucesso": True, "agendado": True, "agendamento_id": ag_id}

        # Envio imediato via SMTP
        sucesso, erro = send_smtp_email(to_email, assunto, html, bcc_list)

        # Registra no histórico
        db.execute("""
            INSERT INTO emails_enviados (
                empresa_id, tipo_backup, tipo_email, template_id,
                assunto, destinatario_principal, bcc_emails, status, erro, html_content, data_envio
            ) VALUES (?, ?, 'falha', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            payload.empresa_id, tipo_backup, payload.template_id,
            assunto, to_email, ", ".join(bcc_list),
            "sucesso" if sucesso else "erro", erro, html
        ))

        if sucesso:
            db.execute("UPDATE falhas SET ultimo_email_enviado = CURRENT_TIMESTAMP WHERE empresa_id = ? AND status = 'em_falha'", (payload.empresa_id,))

        log_auditoria("FALHAS", payload.empresa_id, "DISPARAR_FALHA_SMTP", f"Disparo de falha para {empresa_nome} - Status: {'Sucesso' if sucesso else 'Erro: ' + str(erro)}", db=db)

        if not sucesso:
            raise HTTPException(status_code=500, detail=f"Erro no envio SMTP: {erro}")

        return {"sucesso": True, "destinatario": to_email, "bcc_count": len(bcc_list)}
