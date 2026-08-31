from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db, log_auditoria
from services.template_service import (
    list_templates,
    get_template_by_id_or_key,
    save_template,
    get_available_variables,
    render_template_email,
    replace_template_variables
)
from services.smtp_service import send_smtp_email

router = APIRouter(prefix="/api/templates", tags=["Templates"])


class TemplatePayload(BaseModel):
    id: int | None = None
    chave: str
    nome: str
    categoria: str = "info"
    finalidade: str | None = None
    tipo_backup_relacionado: str = "geral"
    aplicavel_a: list[str] = []
    assunto: str
    html_content: str
    corpo_json: str | None = "[]"
    estilo: str = "marca"
    status: str = "ativo"


class PreviewPayload(BaseModel):
    template_id: int | None = None
    html_content: str | None = None
    assunto: str | None = None
    estilo: str = "marca"
    empresa_id: int | None = None
    empresa_nome: str | None = "EMPRESA EXEMPLO LTDA"
    responsavel: str | None = "Carlos Silva"
    tipo_backup: str | None = "Semanal"


class TestSendPayload(BaseModel):
    destinatario: str
    assunto: str
    html_content: str
    template_id: int | None = None


@router.get("")
def get_templates():
    return list_templates()


@router.get("/variaveis")
def get_variables():
    return get_available_variables()


@router.get("/{identifier}")
def get_template(identifier: str):
    tpl = get_template_by_id_or_key(identifier)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    return tpl


@router.post("")
def create_template(payload: TemplatePayload):
    tpl = save_template(payload.dict())
    return tpl


@router.put("/{id}")
def update_template(id: int, payload: TemplatePayload):
    data = payload.dict()
    data["id"] = id
    tpl = save_template(data)
    return tpl


@router.delete("/{id}")
def delete_template(id: int):
    with get_db() as db:
        tpl = db.execute("SELECT nome FROM templates WHERE id = ?", (id,)).fetchone()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template não encontrado.")
        db.execute("DELETE FROM templates WHERE id = ?", (id,))
        log_auditoria("TEMPLATES", id, "EXCLUIR_TEMPLATE", f"Template '{tpl['nome']}' removido.", db=db)
        return {"sucesso": True}


@router.post("/preview")
def preview_template(payload: PreviewPayload):
    context = {
        "empresa": payload.empresa_nome or "EMPRESA EXEMPLO LTDA",
        "responsavel": payload.responsavel or "Carlos Silva",
        "tipo_backup": payload.tipo_backup or "Semanal",
        "contato": payload.responsavel or "Carlos Silva",
        "nome_cliente": payload.empresa_nome or "EMPRESA EXEMPLO LTDA",
    }

    if payload.empresa_id:
        with get_db() as db:
            emp = db.execute("SELECT nome, responsavel_principal FROM empresas WHERE id = ?", (payload.empresa_id,)).fetchone()
            if emp:
                context["empresa"] = emp["nome"]
                context["responsavel"] = emp["responsavel_principal"] or emp["nome"]
                context["contato"] = emp["responsavel_principal"] or emp["nome"]
                context["nome_cliente"] = emp["nome"]

    if payload.html_content is not None and payload.assunto is not None:
        template_mock = {
            "nome": payload.assunto,
            "assunto": payload.assunto,
            "html_content": payload.html_content,
            "estilo": payload.estilo,
        }
        assunto, html = render_template_email(template_mock, context, preview_mode=True)
    elif payload.template_id:
        tpl = get_template_by_id_or_key(payload.template_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Template não encontrado.")
        assunto, html = render_template_email(tpl, context, preview_mode=True)
    else:
        raise HTTPException(status_code=400, detail="Informe o template ou o código HTML.")

    return {"assunto": assunto, "html": html, "variaveis_aplicadas": context}


@router.post("/test-send")
def test_send_template(payload: TestSendPayload):
    sucesso, erro = send_smtp_email(
        to_email=payload.destinatario,
        subject=payload.assunto,
        html_content=payload.html_content,
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail=f"Falha ao enviar e-mail de teste: {erro}")
    return {"sucesso": True, "mensagem": f"E-mail de teste enviado com sucesso para {payload.destinatario}!"}
