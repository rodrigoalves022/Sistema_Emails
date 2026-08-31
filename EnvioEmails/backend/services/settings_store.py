import json
from threading import RLock

from cryptography.fernet import Fernet

import config
from config import BASE_DIR, settings

SETTINGS_FILE = BASE_DIR / "settings.json"
# RLock (reentrante): save_settings já segura o lock quando chama
# load_settings/_encrypt_password, que por sua vez podem chamar
# _get_or_create_enc_key, que também precisa do lock. Com um Lock comum
# isso causaria deadlock (mesma thread tentando adquirir o lock 2x).
_lock = RLock()

DEFAULT_SETTINGS = {
    "smtp_host": settings.smtp_host or "",
    "smtp_port": settings.smtp_port or 465,
    "smtp_use_ssl": settings.smtp_use_ssl if settings.smtp_use_ssl is not None else True,
    "smtp_user": settings.smtp_user or "",
    "smtp_password": settings.smtp_password or "",
    "smtp_from_email": settings.smtp_from_email or "clientes.backup@coretiexpert.com.br",
    "smtp_from_name": settings.smtp_from_name or "Core TI Expert - Departamento de Backup",
    "signature_company": "Core TI Expert",
    "signature_dept": "Departamento de Backup",
    "signature_phone": "(62) 3242-5830",
    "signature_email": "clientes.backup@coretiexpert.com.br",
}


def _get_or_create_enc_key() -> bytes:
    """Retorna a chave Fernet usada para cifrar `smtp_password` em disco.

    Se `SETTINGS_ENC_KEY` ainda não existir em `.env`, gera uma nova chave,
    persiste no arquivo (criando-o se necessário) e atualiza o objeto
    `settings` já carregado em memória, para que o restante do processo
    atual enxergue a chave sem precisar reiniciar.
    """
    key = settings.settings_enc_key
    if key:
        return key.encode("utf-8")

    new_key = Fernet.generate_key()
    new_key_str = new_key.decode("utf-8")

    with _lock:
        # Usa config.ENV_FILE (em vez de um valor importado diretamente) para que
        # testes consigam sobrescrever via monkeypatch em `config.ENV_FILE`.
        env_file = config.ENV_FILE

        # Relê o .env (se existir) para não sobrescrever outras variáveis já salvas.
        lines = []
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                lines = f.readlines()

        # Remove qualquer linha antiga de SETTINGS_ENC_KEY (não deveria existir, mas por segurança).
        lines = [l for l in lines if not l.strip().startswith("SETTINGS_ENC_KEY=")]
        if lines and not lines[-1].endswith("\n"):
            lines[-1] += "\n"
        lines.append(f"SETTINGS_ENC_KEY={new_key_str}\n")

        with open(env_file, "w", encoding="utf-8") as f:
            f.writelines(lines)

    settings.settings_enc_key = new_key_str
    return new_key


def _get_cipher() -> Fernet:
    return Fernet(_get_or_create_enc_key())


def _encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    cipher = _get_cipher()
    return cipher.encrypt(plain.encode("utf-8")).decode("utf-8")


def _decrypt_password(stored: str) -> str:
    """Decifra a senha armazenada. Trata o caso legado de senha ainda em
    texto puro (gravada antes desta migração): se a decifragem falhar,
    assume que o valor já é o texto puro e o retorna como está — na
    próxima vez que `save_settings` for chamado, será re-gravado já cifrado.
    """
    if not stored:
        return ""
    cipher = _get_cipher()
    try:
        return cipher.decrypt(stored.encode("utf-8")).decode("utf-8")
    except Exception:
        # Valor legado em texto puro (ou corrompido) - devolve como está.
        return stored


def load_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return dict(DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            merged = dict(DEFAULT_SETTINGS)
            merged.update(data)
            if merged.get("smtp_password"):
                merged["smtp_password"] = _decrypt_password(merged["smtp_password"])
            return merged
    except Exception:
        return dict(DEFAULT_SETTINGS)


def save_settings(data: dict) -> dict:
    with _lock:
        current = load_settings()
        # Do not overwrite password if empty string provided
        if "smtp_password" in data and not data["smtp_password"] and current.get("smtp_password"):
            data["smtp_password"] = current["smtp_password"]

        current.update(data)

        to_persist = dict(current)
        if to_persist.get("smtp_password"):
            to_persist["smtp_password"] = _encrypt_password(to_persist["smtp_password"])

        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(to_persist, f, indent=2, ensure_ascii=False)
        return current


def is_smtp_configured() -> bool:
    cfg = load_settings()
    return bool(cfg.get("smtp_host") and cfg.get("smtp_user") and cfg.get("smtp_password") and cfg.get("smtp_from_email"))
