from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db, log_auditoria
from services.scheduler_service import execute_agendamento
from services.template_service import get_template_by_id_or_key, render_template_email, replace_template_variables
from services.backup_types import normalizar_tipo_backup, TIPOS_BACKUP_CCO_AUTOMATICO

router = APIRouter(prefix="/api/agendamentos", tags=["Agendamentos"])


class AgendamentoCreate(BaseModel):
    empresa_id: int | None = None
    empresa_ids: list[int] | None = None  # Para agendamento em lote
    tipo_backup: str = "Semanal"
    tipo_email: str = "inicio_rotina"  # 'inicio_rotina' | 'solicitacao_disco' | 'finalizacao' | 'falha' | 'manual'
    template_id: int | None = None
    custom_assunto: str | None = None
    custom_html: str | None = None
    data_agendamento: str | None = None  # YYYY-MM-DD
    horario_agendamento: str | None = None  # HH:MM
    destinatario_principal: str | None = None
    bcc_emails: list[str] = []
    enviar_agora: bool = False  # Se True, dispara imediatamente via SMTP


class AgendamentoUpdate(BaseModel):
    template_id: int | None = None
    custom_assunto: str | None = None
    custom_html: str | None = None
    datetime_previsto: str
    destinatario_principal: str
    bcc_emails: str | None = None
    status: str = "agendado"


@router.get("")
def list_agendamentos(
    empresa_id: int | None = None,
    tipo_backup: str | None = None,
    tipo_email: str | None = None,
    status: str | None = None,
    mes: str | None = None,  # YYYY-MM
):
    with get_db() as db:
        query = """
            SELECT 
                a.*,
                e.nome as empresa_nome,
                e.responsavel_principal,
                COALESCE(t.nome, 'Personalizado') as template_nome
            FROM agendamentos a
            JOIN empresas e ON a.empresa_id = e.id
            LEFT JOIN templates t ON a.template_id = t.id
            WHERE 1=1
        """
        params = []

        if empresa_id:
            query += " AND a.empresa_id = ?"
            params.append(empresa_id)

        if tipo_backup:
            query += " AND a.tipo_backup = ?"
            params.append(normalizar_tipo_backup(tipo_backup))

        if tipo_email:
            query += " AND a.tipo_email = ?"
            params.append(tipo_email)

        if status and status != "todos":
            query += " AND a.status = ?"
            params.append(status)

        if mes:
            query += " AND strftime('%Y-%m', a.datetime_previsto) = ?"
            params.append(mes)

        query += " ORDER BY a.datetime_previsto ASC"
        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]


@router.post("")
def create_agendamento(payload: AgendamentoCreate):
    now = datetime.now()
    data_ag = payload.data_agendamento or now.strftime("%Y-%m-%d")
    hora_ag = payload.horario_agendamento or now.strftime("%H:%M")
    datetime_previsto = f"{data_ag} {hora_ag}:00"
    tipo_backup_norm = normalizar_tipo_backup(payload.tipo_backup)

    # Determina empresas alvo (individual ou lote)
    target_ids = []
    if payload.empresa_ids and len(payload.empresa_ids) > 0:
        target_ids = payload.empresa_ids
    elif payload.empresa_id:
        target_ids = [payload.empresa_id]
    else:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma empresa.")

    created_ids = []
    with get_db() as db:
        for emp_id in target_ids:
            # Obtém e-mail principal e secundários se não passados
            to_email = payload.destinatario_principal
            if not to_email:
                row_to = db.execute("SELECT endereco FROM emails WHERE empresa_id = ? AND tipo = 'principal' AND ativo = 1 LIMIT 1", (emp_id,)).fetchone()
                to_email = row_to["endereco"] if row_to else None
            
            if not to_email:
                row_any = db.execute("SELECT endereco FROM emails WHERE empresa_id = ? AND ativo = 1 LIMIT 1", (emp_id,)).fetchone()
                to_email = row_any["endereco"] if row_any else None

            if not to_email:
                continue

            bcc_str = ""
            if payload.bcc_emails and len(payload.bcc_emails) > 0:
                bcc_str = ", ".join(payload.bcc_emails)
            elif payload.tipo_email == "inicio_rotina" and tipo_backup_norm in TIPOS_BACKUP_CCO_AUTOMATICO:
                # CCO automático: só para informativo de início de rotina Semanal/Mensal/Anual.
                rows_bcc = db.execute("SELECT endereco FROM emails WHERE empresa_id = ? AND ativo = 1 AND endereco != ?", (emp_id, to_email)).fetchall()
                bcc_str = ", ".join([r["endereco"] for r in rows_bcc])

            cursor = db.execute("""
                INSERT INTO agendamentos (
                    empresa_id, tipo_backup, tipo_email, template_id, custom_assunto, custom_html,
                    datetime_previsto, destinatario_principal, bcc_emails, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                emp_id, tipo_backup_norm, payload.tipo_email, payload.template_id,
                payload.custom_assunto, payload.custom_html, datetime_previsto,
                to_email, bcc_str, 'processando' if payload.enviar_agora else 'agendado'
            ))
            ag_id = cursor.lastrowid
            created_ids.append(ag_id)
            log_auditoria("AGENDAMENTOS", ag_id, "CRIAR_AGENDAMENTO", f"Agendamento #{ag_id} para {datetime_previsto} (Envio imediato: {payload.enviar_agora})", db=db)

    # Se envio imediato foi solicitado, executa imediatamente fora do bloco da transação
    total_sucesso = 0
    total_erros = 0
    detalhes_erros = []

    if payload.enviar_agora:
        for ag_id in created_ids:
            sucesso, erro = execute_agendamento(ag_id)
            if sucesso:
                total_sucesso += 1
            else:
                total_erros += 1
                detalhes_erros.append(f"#{ag_id}: {erro}")

    return {
        "sucesso": True,
        "total_criados": len(created_ids),
        "ids": created_ids,
        "enviados_agora": payload.enviar_agora,
        "total_sucesso": total_sucesso,
        "total_erros": total_erros,
        "detalhes_erros": detalhes_erros,
    }


@router.get("/{id}")
def get_agendamento(id: int):
    with get_db() as db:
        ag = db.execute("""
            SELECT a.*, e.nome as empresa_nome, e.responsavel_principal, COALESCE(t.nome, 'Personalizado') as template_nome
            FROM agendamentos a
            JOIN empresas e ON a.empresa_id = e.id
            LEFT JOIN templates t ON a.template_id = t.id
            WHERE a.id = ?
        """, (id,)).fetchone()
        if not ag:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        return dict(ag)


@router.put("/{id}")
def update_agendamento(id: int, payload: AgendamentoUpdate):
    with get_db() as db:
        db.execute("""
            UPDATE agendamentos SET
                template_id = ?, custom_assunto = ?, custom_html = ?,
                datetime_previsto = ?, destinatario_principal = ?, bcc_emails = ?,
                status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            payload.template_id, payload.custom_assunto, payload.custom_html,
            payload.datetime_previsto, payload.destinatario_principal, payload.bcc_emails,
            payload.status, id
        ))
        log_auditoria("AGENDAMENTOS", id, "ATUALIZAR_AGENDAMENTO", f"Agendamento #{id} atualizado.", db=db)
        return {"sucesso": True}


@router.post("/{id}/cancelar")
def cancel_agendamento(id: int):
    with get_db() as db:
        db.execute("UPDATE agendamentos SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (id,))
        log_auditoria("AGENDAMENTOS", id, "CANCELAR_AGENDAMENTO", f"Agendamento #{id} cancelado.", db=db)
        return {"sucesso": True, "mensagem": "Agendamento cancelado com sucesso."}


@router.delete("/{id}")
def delete_agendamento(id: int):
    with get_db() as db:
        db.execute("DELETE FROM agendamentos WHERE id = ?", (id,))
        log_auditoria("AGENDAMENTOS", id, "EXCLUIR_AGENDAMENTO", f"Agendamento #{id} excluído.", db=db)
        return {"sucesso": True}


@router.post("/{id}/executar")
def execute_now(id: int):
    sucesso, erro = execute_agendamento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar e-mail: {erro}")
    return {"sucesso": True, "mensagem": "E-mail disparado com sucesso via SMTP!"}


@router.post("/{id}/reintentar")
def retry_agendamento(id: int):
    with get_db() as db:
        db.execute("UPDATE agendamentos SET status = 'agendado', erro = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (id,))
    return {"sucesso": True, "mensagem": "Agendamento recolocado na fila para envio."}
