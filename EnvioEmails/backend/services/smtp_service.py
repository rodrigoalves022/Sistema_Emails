import re
import smtplib
import socket
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import LOGO_PATH
from services import settings_store

_TAG_RE = re.compile(r"<[^>]+>")


def _to_plain_text(html_content: str, subject: str) -> str:
    cfg = settings_store.load_settings()
    comp = cfg.get("signature_company", "Core TI Expert")
    dept = cfg.get("signature_dept", "Departamento de Backup")
    fone = cfg.get("signature_phone", "(62) 3242-5830")
    mail = cfg.get("signature_email", "clientes.backup@coretiexpert.com.br")

    clean_text = _TAG_RE.sub(" ", html_content)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()
    return f"{subject}\n\n{clean_text}\n\nAtenciosamente,\n{comp} - {dept}\nFone: {fone}\nE-mail: {mail}"


def send_smtp_email(
    to_email: str,
    subject: str,
    html_content: str,
    cc_emails: list[str] | None = None,
) -> tuple[bool, str | None]:
    """
    Envia e-mail estritamente via SMTP.
    - `to_email`: Destinatário principal visível no header To:
    - `cc_emails`: Lista de e-mails secundários da MESMA empresa do destinatário principal.
      Cada disparo é sempre isolado por empresa (nunca mistura contatos de empresas
      diferentes numa mesma mensagem), então esses endereços vão em cópia VISÍVEL
      (`Cc:`, aparece no cabeçalho para todos os destinatários) e também compõem a
      lista de destinatários do envelope SMTP para que a entrega de fato aconteça.
      BCC oculto de verdade (endereço que recebe a mensagem sem aparecer em nenhum
      cabeçalho para os demais) fica reservado para o caso, hoje inexistente no
      código, de uma mensagem que envolva mais de uma empresa — não implementado
      aqui.
    Retorna (sucesso: bool, erro: str | None).
    """
    cc_emails = [e.strip() for e in (cc_emails or []) if e and e.strip()]
    to_email = to_email.strip()
    if not to_email:
        return False, "Destinatário principal não informado."

    cfg = settings_store.load_settings()
    if not settings_store.is_smtp_configured():
        return False, "Configurações de SMTP incompletas. Acesse a aba Configurações no sistema."

    host = cfg.get("smtp_host")
    port = int(cfg.get("smtp_port", 465))
    use_ssl = bool(cfg.get("smtp_use_ssl", True))
    user = cfg.get("smtp_user")
    password = cfg.get("smtp_password")
    from_email = cfg.get("smtp_from_email", "clientes.backup@coretiexpert.com.br")
    from_name = cfg.get("smtp_from_name", "Core TI Expert - Departamento de Backup")

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    if cc_emails:
        msg["Cc"] = ", ".join(cc_emails)

    plain_text = _to_plain_text(html_content, subject)
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(plain_text, "plain", "utf-8"))
    alt.attach(MIMEText(html_content, "html", "utf-8"))
    msg.attach(alt)

    if LOGO_PATH.exists():
        try:
            with open(LOGO_PATH, "rb") as f:
                logo = MIMEImage(f.read())
            logo.add_header("Content-ID", "<logo>")
            logo.add_header("Content-Disposition", "inline", filename="logo.png")
            msg.attach(logo)
        except Exception:
            pass

    # Envelope recipients list = [To] + [Cc] (Cc já visível no header acima)
    envelope_recipients = list(dict.fromkeys([to_email] + cc_emails))

    try:
        if use_ssl or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=25)
        else:
            server = smtplib.SMTP(host, port, timeout=25)
            server.starttls()

        with server:
            server.login(user, password)
            server.sendmail(from_email, envelope_recipients, msg.as_string())
        return True, None
    except smtplib.SMTPAuthenticationError:
        return False, "Falha de autenticação SMTP: Usuário ou senha incorretos."
    except smtplib.SMTPRecipientsRefused as err:
        return False, f"Destinatários recusados pelo servidor: {err}"
    except (smtplib.SMTPConnectError, socket.timeout, socket.gaierror, ConnectionRefusedError) as err:
        return False, f"Falha de conexão com o servidor SMTP ({host}:{port}): {err}"
    except smtplib.SMTPException as exc:
        return False, f"Erro SMTP: {exc}"
    except Exception as exc:
        return False, f"Erro inesperado no envio: {exc}"


def test_smtp_connection() -> tuple[bool, str]:
    """Testa apenas a autenticação e conexão com o servidor SMTP."""
    cfg = settings_store.load_settings()
    if not settings_store.is_smtp_configured():
        return False, "Preencha todos os campos obrigatórios (Host, Porta, Usuário, Senha e Remetente)."

    host = cfg.get("smtp_host")
    port = int(cfg.get("smtp_port", 465))
    use_ssl = bool(cfg.get("smtp_use_ssl", True))
    user = cfg.get("smtp_user")
    password = cfg.get("smtp_password")

    try:
        if use_ssl or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()

        with server:
            server.login(user, password)
        return True, "Conexão e autenticação SMTP estabelecidas com sucesso!"
    except Exception as exc:
        return False, f"Falha ao conectar: {exc}"
