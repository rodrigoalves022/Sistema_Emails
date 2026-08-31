from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import log_auditoria
from services import settings_store
from services.smtp_service import test_smtp_connection, send_smtp_email

router = APIRouter(prefix="/api/settings", tags=["Configurações"])


class SettingsUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_use_ssl: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "clientes.backup@coretiexpert.com.br"
    smtp_from_name: str = "Core TI Expert - Departamento de Backup"
    signature_company: str = "Core TI Expert"
    signature_dept: str = "Departamento de Backup"
    signature_phone: str = "(62) 3242-5830"
    signature_email: str = "clientes.backup@coretiexpert.com.br"


class TestEmailPayload(BaseModel):
    destinatario_teste: str | None = None


@router.get("")
def get_settings():
    cfg = settings_store.load_settings()
    # Mask password for display
    resp = dict(cfg)
    if resp.get("smtp_password"):
        resp["smtp_password_configured"] = True
        resp["smtp_password"] = "••••••••"
    else:
        resp["smtp_password_configured"] = False
    return resp


@router.post("")
def save_settings(data: SettingsUpdate):
    payload = data.dict()
    # Do not overwrite if masked
    if payload.get("smtp_password") == "••••••••":
        del payload["smtp_password"]

    updated = settings_store.save_settings(payload)
    log_auditoria("CONFIGURACOES", None, "SALVAR_CONFIGURACOES", f"Configurações SMTP atualizadas para {data.smtp_from_email}")
    return get_settings()


@router.post("/test-connection")
def test_connection():
    sucesso, msg = test_smtp_connection()
    if not sucesso:
        raise HTTPException(status_code=400, detail=msg)
    return {"sucesso": True, "mensagem": msg}


@router.post("/test-smtp")
def send_test_email(data: TestEmailPayload):
    cfg = settings_store.load_settings()
    dest = data.destinatario_teste or cfg.get("smtp_from_email") or "clientes.backup@coretiexpert.com.br"

    if not dest:
        raise HTTPException(status_code=400, detail="Informe um endereço de e-mail de destino para o teste.")

    assunto = "Teste de Envio — Core TI Expert (Sistema de Backup)"
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #334155;">
        <h2 style="color: #00B39B;">✓ Conexão SMTP Bem-Sucedida!</h2>
        <p>Este é um e-mail de teste enviado pelo <strong>Sistema de Gerenciamento de Rotinas de Backup</strong> da <strong>{cfg.get('signature_company', 'Core TI Expert')}</strong>.</p>
        <p>Se você recebeu esta mensagem, significa que o servidor SMTP está configurado e pronto para os envios de comunicação e solicitação de troca de disco.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 13px; color: #64748b;">
            Remetente: {cfg.get('smtp_from_name', 'Core TI Expert')} &lt;{cfg.get('smtp_from_email')}&gt;<br>
            Servidor: {cfg.get('smtp_host')}:{cfg.get('smtp_port')}
        </p>
    </div>
    """

    sucesso, erro = send_smtp_email(to_email=dest, subject=assunto, html_content=html)
    if not sucesso:
        raise HTTPException(status_code=500, detail=f"Erro ao disparar e-mail de teste: {erro}")

    log_auditoria("CONFIGURACOES", None, "TESTE_SMTP_ENVIO", f"E-mail de teste disparado para {dest}")
    return {"sucesso": True, "mensagem": f"E-mail de teste enviado com sucesso para {dest}!"}
