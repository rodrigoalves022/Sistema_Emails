"""Testes de CRUD de templates de e-mail e do campo `aplicavel_a` (vínculo
template <-> múltiplos tipos_backup, Fase 2.2 do plano de ação).
"""

TEMPLATE_BASE = {
    "chave": "teste_template_disco",
    "nome": "Solicitação de Disco",
    "categoria": "cobranca",
    "finalidade": "Solicitar troca de disco",
    "tipo_backup_relacionado": "semanal",
    "aplicavel_a": ["diario", "semanal", "mensal", "anual"],
    "assunto": "Solicitamos o disco de backup - {{empresa}}",
    "html_content": "<p>Prezado(a) {{responsavel}}, favor providenciar o disco de backup.</p>",
    "corpo_json": "[]",
    "estilo": "marca",
    "status": "ativo",
}


def test_criar_template_com_multiplos_tipos_aplicavel_a(client):
    resp = client.post("/api/templates", json=TEMPLATE_BASE)
    assert resp.status_code == 200, resp.text
    criado = resp.json()
    assert criado["chave"] == TEMPLATE_BASE["chave"]
    assert criado["aplicavel_a"] == TEMPLATE_BASE["aplicavel_a"]
    tpl_id = criado["id"]

    # Lê de volta por id
    resp = client.get(f"/api/templates/{tpl_id}")
    assert resp.status_code == 200
    assert resp.json()["aplicavel_a"] == TEMPLATE_BASE["aplicavel_a"]

    # Lê de volta por chave
    resp = client.get(f"/api/templates/{TEMPLATE_BASE['chave']}")
    assert resp.status_code == 200
    assert resp.json()["aplicavel_a"] == TEMPLATE_BASE["aplicavel_a"]

    # Aparece na listagem já decodificado (lista, não JSON cru)
    resp = client.get("/api/templates")
    assert resp.status_code == 200
    listado = next(t for t in resp.json() if t["chave"] == TEMPLATE_BASE["chave"])
    assert listado["aplicavel_a"] == TEMPLATE_BASE["aplicavel_a"]


def test_atualizar_template_persiste_novo_aplicavel_a(client):
    resp = client.post("/api/templates", json=TEMPLATE_BASE)
    assert resp.status_code == 200
    tpl_id = resp.json()["id"]

    atualizado = dict(TEMPLATE_BASE)
    atualizado["id"] = tpl_id
    # "Informar finalização" normalmente só se aplica a semanal/mensal/anual
    atualizado["aplicavel_a"] = ["semanal", "mensal", "anual"]

    resp = client.put(f"/api/templates/{tpl_id}", json=atualizado)
    assert resp.status_code == 200, resp.text
    assert resp.json()["aplicavel_a"] == ["semanal", "mensal", "anual"]

    resp = client.get(f"/api/templates/{tpl_id}")
    assert resp.json()["aplicavel_a"] == ["semanal", "mensal", "anual"]


def test_template_sem_aplicavel_a_retorna_lista_vazia(client):
    payload = dict(TEMPLATE_BASE)
    payload["chave"] = "teste_template_sem_aplicavel_a"
    del payload["aplicavel_a"]

    resp = client.post("/api/templates", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json()["aplicavel_a"] == []


def test_remover_template(client):
    resp = client.post("/api/templates", json=TEMPLATE_BASE)
    assert resp.status_code == 200
    tpl_id = resp.json()["id"]

    resp = client.delete(f"/api/templates/{tpl_id}")
    assert resp.status_code == 200
    assert resp.json() == {"sucesso": True}

    resp = client.get(f"/api/templates/{tpl_id}")
    assert resp.status_code == 404
