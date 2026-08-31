"""Configuração compartilhada da suíte de testes do backend.

A suíte roda contra o app FastAPI real (main.app) e as rotas SQLite reais,
mas cada teste recebe um banco de dados SQLite temporário e isolado
(`database.DB_PATH` é redirecionado via monkeypatch para um arquivo dentro
de `tmp_path`, e `init_db()` é chamado manualmente nesse arquivo).

Importante: o `TestClient` é usado SEM o gerenciador de contexto
(`with TestClient(app) as client: ...`), de propósito. Sem o `with`, o
`lifespan` do FastAPI (que faria seed de templates e, principalmente,
importaria a planilha real de clientes se o banco estivesse vazio) NUNCA
roda. Isso garante que nenhum teste desta suíte toque a planilha real
(`Bancos/cadastro_clientes.xlsx`) nem o `backup_emails.db` de produção.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import database  # noqa: E402
from main import app  # noqa: E402
from services import settings_store  # noqa: E402


@pytest.fixture(autouse=True)
def banco_temporario(tmp_path, monkeypatch):
    """Redireciona o banco SQLite e o settings.json para arquivos temporários
    e inicializa o schema do banco temporário antes de cada teste."""
    db_path = tmp_path / "test_backup_emails.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    monkeypatch.setattr(settings_store, "SETTINGS_FILE", tmp_path / "settings.json")

    database.init_db()
    yield db_path


@pytest.fixture
def client():
    """TestClient síncrono do FastAPI apontando para o app real, sem disparar
    o lifespan (ver docstring do módulo)."""
    return TestClient(app)
