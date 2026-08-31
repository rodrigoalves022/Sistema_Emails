"""Testes de CRUD de clientes/empresas via API (SQLite real) e do preview de
importação de Excel, cobrindo a Fase 1 do plano de ação: nenhum dado deve ser
fabricado (nem tipos_backup padrão, nem responsavel_principal derivado do
e-mail).
"""

import io

import openpyxl


CLIENTE_BASE = {
    "nome": "Empresa Teste Ltda",
    "responsavel_principal": None,
    "status": "ativo",
    "observacoes": "Cliente de teste",
    "backup_em_falha": 0,
    "tipos_backup": [],
    "contatos": [],
    "emails": [
        {"endereco": "contato@empresateste.com.br", "tipo": "principal", "ativo": 1},
    ],
}


def test_criar_cliente_sem_tipos_backup_fabricados(client):
    """Criar uma empresa sem informar tipos_backup não deve fabricar nenhum
    tipo (RN Fase 1) - o default do schema é lista vazia."""
    resp = client.post("/api/clients", json=CLIENTE_BASE)
    assert resp.status_code == 200, resp.text
    criado = resp.json()
    assert criado["nome"] == CLIENTE_BASE["nome"]
    assert criado["tipos_backup"] == []
    assert criado["id"] > 0
    client_id = criado["id"]

    # Confirma via GET de detalhe também
    resp = client.get(f"/api/clients/{client_id}")
    assert resp.status_code == 200
    detalhe = resp.json()
    assert detalhe["tipos_backup"] == []
    # Todos os tipos suportados aparecem no detalhamento, mas nenhum ativo.
    assert all(not t["ativo"] for t in detalhe["tipos_backup_detalhes"])


def test_crud_cliente_completo(client):
    payload = dict(CLIENTE_BASE)
    payload["tipos_backup"] = ["mensal", "cloud"]

    resp = client.post("/api/clients", json=payload)
    assert resp.status_code == 200, resp.text
    criado = resp.json()
    client_id = criado["id"]
    assert set(criado["tipos_backup"]) == {"mensal", "cloud"}

    # Listar
    resp = client.get("/api/clients")
    assert resp.status_code == 200
    assert any(c["id"] == client_id for c in resp.json())

    # Editar
    editado = dict(payload)
    editado["nome"] = "Empresa Teste Ltda (Editada)"
    editado["status"] = "inativo"
    resp = client.put(f"/api/clients/{client_id}", json=editado)
    assert resp.status_code == 200
    atualizado = resp.json()
    assert atualizado["nome"] == "Empresa Teste Ltda (Editada)"
    assert atualizado["status"] == "inativo"

    # Excluir
    resp = client.delete(f"/api/clients/{client_id}")
    assert resp.status_code == 200

    resp = client.get(f"/api/clients/{client_id}")
    assert resp.status_code == 404


def test_criar_cliente_duplicado_retorna_400(client):
    resp = client.post("/api/clients", json=CLIENTE_BASE)
    assert resp.status_code == 200

    resp = client.post("/api/clients", json=CLIENTE_BASE)
    assert resp.status_code == 400


def test_toggle_backup_type_aceita_json(client):
    """Fase 3.5: o endpoint de toggle de tipo de backup deve aceitar um body
    JSON simples (Pydantic), não mais multipart/form-encoded."""
    resp = client.post("/api/clients", json=CLIENTE_BASE)
    client_id = resp.json()["id"]

    resp = client.post(
        f"/api/clients/{client_id}/toggle-backup-type",
        json={"tipo": "semanal", "ativo": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sucesso": True, "tipo": "semanal", "ativo": True}

    resp = client.get(f"/api/clients/{client_id}")
    assert "semanal" in resp.json()["tipos_backup"]


# --- Preview de importação de Excel -----------------------------------------

def _gerar_xlsx_simples(linhas: list[list]) -> bytes:
    """Gera um .xlsx em memória só com as colunas Cliente/Emails, igual ao
    Excel real de origem (nunca lê planilhas reais de `Bancos/`)."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Cliente", "Emails"])
    for linha in linhas:
        ws.append(linha)
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()


def test_preview_import_excel_nao_fabrica_tipos_backup_nem_responsavel(client):
    conteudo = _gerar_xlsx_simples(
        [
            ["Empresa Alpha", "alpha@example.com; sec1@example.com"],
            ["Empresa Beta", "contato.beta@example.com"],
        ]
    )
    resp = client.post(
        "/api/clients/import/preview",
        files={
            "arquivo": (
                "clientes.xlsx",
                conteudo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_empresas"] == 2

    for empresa in body["empresas"]:
        assert empresa["tipos_backup"] == []
        assert empresa["responsavel_principal"] in ("", None)

    alpha = next(e for e in body["empresas"] if e["nome"] == "EMPRESA ALPHA")
    assert len(alpha["contatos_emails"]) == 2
    emails_alpha = {c["email"] for c in alpha["contatos_emails"]}
    assert emails_alpha == {"alpha@example.com", "sec1@example.com"}
