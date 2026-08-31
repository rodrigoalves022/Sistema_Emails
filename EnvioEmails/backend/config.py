from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    smtp_host: str = ""
    smtp_port: int = 465
    smtp_use_ssl: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Core TI Expert - Departamento de Backup"

    # Chave Fernet (base64) usada para cifrar a senha SMTP persistida em settings.json.
    # Gerada automaticamente e persistida em .env na primeira execução caso ausente
    # (ver services/settings_store.py::_get_or_create_enc_key).
    settings_enc_key: str = ""

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password and self.smtp_from_email)


settings = Settings()

LOGO_PATH = BASE_DIR / "assets" / "logo.png"
TEMPLATES_DIR = BASE_DIR / "templates"

BANCOS_DIR = BASE_DIR.parent.parent / "Bancos"
