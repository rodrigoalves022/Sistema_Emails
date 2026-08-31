"""Testes da Fase 4 (segurança): a senha SMTP deve ser cifrada em disco
(settings.json) e nunca devolvida em texto puro pela API.

Cobre também uma regressão específica: `save_settings` usava um
`threading.Lock` comum e, ao cifrar a senha, acabava tentando readquirir o
mesmo lock (via `_get_or_create_enc_key`) na mesma thread - um deadlock
permanente. Corrigido trocando para `threading.RLock`. Este teste falha por
timeout se o deadlock for reintroduzido.
"""

import json


def test_salvar_configuracoes_cifra_senha_em_disco(client, tmp_path, monkeypatch):
    import config
    from services import settings_store

    settings_file = tmp_path / "settings_seguranca.json"
    env_file = tmp_path / ".env_seguranca"
    monkeypatch.setattr(settings_store, "SETTINGS_FILE", settings_file)
    monkeypatch.setattr(config, "ENV_FILE", env_file)
    monkeypatch.setattr(config.settings, "settings_enc_key", "")

    resp = client.post(
        "/api/settings",
        json={
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "smtp_use_ssl": False,
            "smtp_user": "user@example.com",
            "smtp_password": "SegredoDoTeste123",
            "smtp_from_email": "a@b.com",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # A API nunca deve devolver a senha em texto puro.
    assert body["smtp_password"] != "SegredoDoTeste123"
    assert body["smtp_password_configured"] is True

    # O arquivo em disco também não deve conter o texto puro.
    raw = json.loads(settings_file.read_text(encoding="utf-8"))
    assert raw["smtp_password"] != "SegredoDoTeste123"

    # Uma chave de cifragem deve ter sido gerada e persistida em .env.
    assert env_file.exists()
    assert "SETTINGS_ENC_KEY=" in env_file.read_text(encoding="utf-8")

    # load_settings (uso interno, ex.: para enviar e-mails) decifra corretamente.
    decrypted = settings_store.load_settings()
    assert decrypted["smtp_password"] == "SegredoDoTeste123"


def test_smtp_from_email_tem_fallback_quando_nao_configurado(tmp_path, monkeypatch):
    from services import settings_store

    monkeypatch.setattr(settings_store, "SETTINGS_FILE", tmp_path / "nao_existe.json")
    cfg = settings_store.load_settings()
    assert cfg["smtp_from_email"] == "clientes.backup@coretiexpert.com.br"
