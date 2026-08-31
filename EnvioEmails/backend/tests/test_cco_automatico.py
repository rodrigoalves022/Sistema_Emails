"""Testes da regra de negócio de BCC (CCO) automático (Fase 2.1 do plano de
ação): ao criar um agendamento de e-mail, o preenchimento automático de
`bcc_emails` com todos os e-mails secundários da empresa só pode acontecer
quando `tipo_email == "inicio_rotina"` E o `tipo_backup` normalizado estiver
em {"semanal", "mensal", "anual"}. Em qualquer outro caso (diário,
solicitação de disco, finalização, falha), o BCC deve ficar vazio a menos
que o operador informe explicitamente.
"""

EMAIL_PRINCIPAL = "principal@empresateste.com.br"
EMAILS_SECUNDARIOS = ["sec1@empresateste.com.br", "sec2@empresateste.com.br"]


def _criar_cliente_com_emails(client) -> int:
    payload = {
        "nome": "Cliente BCC Teste",
        "status": "ativo",
        "tipos_backup": ["semanal", "diario"],
        "contatos": [],
        "emails": [
            {"endereco": EMAIL_PRINCIPAL, "tipo": "principal", "ativo": 1},
            {"endereco": EMAILS_SECUNDARIOS[0], "tipo": "secundario", "ativo": 1},
            {"endereco": EMAILS_SECUNDARIOS[1], "tipo": "secundario", "ativo": 1},
        ],
    }
    resp = client.post("/api/clients", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _criar_agendamento(client, empresa_id: int, tipo_backup: str, tipo_email: str) -> dict:
    resp = client.post(
        "/api/agendamentos",
        json={
            "empresa_id": empresa_id,
            "tipo_backup": tipo_backup,
            "tipo_email": tipo_email,
            "data_agendamento": "2026-09-01",
            "horario_agendamento": "10:00",
        },
    )
    assert resp.status_code == 200, resp.text
    ag_id = resp.json()["ids"][0]

    resp = client.get(f"/api/agendamentos/{ag_id}")
    assert resp.status_code == 200
    return resp.json()


def test_solicitacao_disco_nao_popula_bcc_automaticamente(client):
    empresa_id = _criar_cliente_com_emails(client)
    ag = _criar_agendamento(client, empresa_id, tipo_backup="semanal", tipo_email="solicitacao_disco")

    assert not ag.get("bcc_emails")


def test_inicio_rotina_semanal_popula_bcc_automaticamente(client):
    empresa_id = _criar_cliente_com_emails(client)
    ag = _criar_agendamento(client, empresa_id, tipo_backup="semanal", tipo_email="inicio_rotina")

    bcc = [b.strip() for b in (ag.get("bcc_emails") or "").split(",") if b.strip()]
    assert set(bcc) == set(EMAILS_SECUNDARIOS)


def test_inicio_rotina_mensal_e_anual_populam_bcc_automaticamente(client):
    empresa_id = _criar_cliente_com_emails(client)

    for tipo_backup in ("mensal", "anual"):
        ag = _criar_agendamento(client, empresa_id, tipo_backup=tipo_backup, tipo_email="inicio_rotina")
        bcc = [b.strip() for b in (ag.get("bcc_emails") or "").split(",") if b.strip()]
        assert set(bcc) == set(EMAILS_SECUNDARIOS)


def test_inicio_rotina_diario_nao_popula_bcc_automaticamente(client):
    """Guarda explícita da regra: "diario" nunca deve disparar CCO automático,
    mesmo em um informativo de início de rotina."""
    empresa_id = _criar_cliente_com_emails(client)
    ag = _criar_agendamento(client, empresa_id, tipo_backup="diario", tipo_email="inicio_rotina")

    assert not ag.get("bcc_emails")


def test_finalizacao_nao_popula_bcc_automaticamente(client):
    empresa_id = _criar_cliente_com_emails(client)
    ag = _criar_agendamento(client, empresa_id, tipo_backup="semanal", tipo_email="finalizacao")

    assert not ag.get("bcc_emails")


def test_bcc_manual_e_sempre_respeitado_independente_do_tipo(client):
    """O operador continua podendo informar BCC manualmente em qualquer tipo
    de e-mail (o campo manual nunca é bloqueado pela regra restrita)."""
    empresa_id = _criar_cliente_com_emails(client)
    resp = client.post(
        "/api/agendamentos",
        json={
            "empresa_id": empresa_id,
            "tipo_backup": "diario",
            "tipo_email": "solicitacao_disco",
            "data_agendamento": "2026-09-01",
            "horario_agendamento": "10:00",
            "bcc_emails": [EMAILS_SECUNDARIOS[0]],
        },
    )
    assert resp.status_code == 200, resp.text
    ag_id = resp.json()["ids"][0]

    resp = client.get(f"/api/agendamentos/{ag_id}")
    assert resp.json()["bcc_emails"] == EMAILS_SECUNDARIOS[0]


def test_tipo_backup_e_normalizado_para_slug_minusculo(client):
    """RN Fase 2.3: o valor gravado em agendamentos.tipo_backup deve ser
    sempre o slug minúsculo, mesmo que o caller envie capitalizado."""
    empresa_id = _criar_cliente_com_emails(client)
    ag = _criar_agendamento(client, empresa_id, tipo_backup="Semanal", tipo_email="inicio_rotina")

    assert ag["tipo_backup"] == "semanal"
