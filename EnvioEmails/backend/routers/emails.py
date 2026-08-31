from fastapi import APIRouter, HTTPException
from database import get_db, log_auditoria
from services.smtp_service import send_smtp_email
from services.template_service import get_template_by_id_or_key, render_template_email

router = APIRouter(prefix="/api/emails", tags=["E-mails Enviados / Histórico"])


@router.get("/historico")
def get_historico(
    busca: str | None = None,
    status: str | None = None,
    tipo_backup: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    limit: int = 100,
):
    with get_db() as db:
        query = """
            SELECT 
                h.*,
                e.nome as empresa_nome,
                e.responsavel_principal,
                COALESCE(t.nome, 'Personalizado') as template_nome
            FROM emails_enviados h
            LEFT JOIN empresas e ON h.empresa_id = e.id
            LEFT JOIN templates t ON h.template_id = t.id
            WHERE 1=1
        """
        params = []

        if busca:
            query += " AND (h.assunto LIKE ? OR h.destinatario_principal LIKE ? OR e.nome LIKE ?)"
            b_val = f"%{busca}%"
            params.extend([b_val, b_val, b_val])

        if status and status != "todos":
            query += " AND h.status = ?"
            params.append(status)

        if tipo_backup:
            query += " AND h.tipo_backup = ?"
            params.append(tipo_backup)

        if data_inicio:
            query += " AND date(h.data_envio) >= ?"
            params.append(data_inicio)

        if data_fim:
            query += " AND date(h.data_envio) <= ?"
            params.append(data_fim)

        query += " ORDER BY h.data_envio DESC LIMIT ?"
        params.append(limit)

        rows = db.execute(query, params).fetchall()
        result = []
        for r in rows:
            item = dict(r)
            # Calcula quantidade de BCCs
            bcc_raw = item.get("bcc_emails") or ""
            bcc_list = [b.strip() for b in bcc_raw.split(",") if b.strip()]
            item["bcc_count"] = len(bcc_list)
            item["bcc_list"] = bcc_list
            result.append(item)

        return result


@router.get("/historico/{id}")
def get_historico_item(id: int):
    with get_db() as db:
        row = db.execute("""
            SELECT 
                h.*,
                e.nome as empresa_nome,
                e.responsavel_principal,
                COALESCE(t.nome, 'Personalizado') as template_nome
            FROM emails_enviados h
            LEFT JOIN empresas e ON h.empresa_id = e.id
            LEFT JOIN templates t ON h.template_id = t.id
            WHERE h.id = ?
        """, (id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Registro não encontrado.")
        item = dict(row)
        bcc_raw = item.get("bcc_emails") or ""
        item["bcc_list"] = [b.strip() for b in bcc_raw.split(",") if b.strip()]
        return item


@router.post("/reenviar/{id}")
def reenviar_email(id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM emails_enviados WHERE id = ?", (id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Registro de envio não encontrado.")

        item = dict(row)
        to_email = item["destinatario_principal"]
        bcc_raw = item.get("bcc_emails") or ""
        bcc_list = [b.strip() for b in bcc_raw.split(",") if b.strip()]
        assunto = item["assunto"]
        empresa_id = item["empresa_id"]

        # Reusa o HTML realmente enviado da vez anterior, se estiver gravado.
        # Só recorre a re-renderizar via template (ou ao texto genérico) para
        # registros antigos, gravados antes da coluna html_content existir.
        html = item.get("html_content") or ""

        if not html and item.get("template_id"):
            tpl = get_template_by_id_or_key(item["template_id"])
            if tpl:
                emp = db.execute("SELECT nome, responsavel_principal FROM empresas WHERE id = ?", (empresa_id,)).fetchone()
                context = {
                    "empresa": emp["nome"] if emp else "",
                    "responsavel": emp["responsavel_principal"] if emp else "",
                    "tipo_backup": item.get("tipo_backup", "Semanal"),
                }
                _, html = render_template_email(tpl, context, preview_mode=False)

        if not html:
            html = f"<p>Reenvio de comunicado: {assunto}</p>"

        sucesso, erro = send_smtp_email(to_email, assunto, html, bcc_list)

        # Insere novo registro de reenvio
        db.execute("""
            INSERT INTO emails_enviados (
                empresa_id, tipo_backup, tipo_email, template_id,
                assunto, destinatario_principal, bcc_emails, status, erro, html_content, data_envio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            empresa_id, item.get("tipo_backup"), item.get("tipo_email"), item.get("template_id"),
            f"[Reenvio] {assunto}", to_email, bcc_raw, "sucesso" if sucesso else "erro", erro, html
        ))

        log_auditoria("EMAILS", id, "REENVIAR_EMAIL", f"Reenvio para {to_email} - Status: {'Sucesso' if sucesso else 'Erro: ' + str(erro)}", db=db)

        if not sucesso:
            raise HTTPException(status_code=500, detail=f"Erro no reenvio SMTP: {erro}")

        return {"sucesso": True, "mensagem": "E-mail reenviado com sucesso via SMTP!"}


@router.delete("/historico/{id}")
def delete_historico_item(id: int):
    with get_db() as db:
        db.execute("DELETE FROM emails_enviados WHERE id = ?", (id,))
        return {"sucesso": True}


@router.delete("/historico")
def clear_historico():
    with get_db() as db:
        db.execute("DELETE FROM emails_enviados")
        log_auditoria("EMAILS", None, "LIMPAR_HISTORICO", "Histórico de e-mails enviados limpo.", db=db)
        return {"sucesso": True, "mensagem": "Histórico limpo com sucesso."}
