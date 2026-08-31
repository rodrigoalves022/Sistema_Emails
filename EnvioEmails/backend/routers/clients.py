import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from database import get_db, log_auditoria
from services.excel_importer import preview_excel_file, import_excel_data
from services.backup_types import normalizar_tipo_backup

router = APIRouter(prefix="/api/clients", tags=["Clientes / Empresas"])


class EmailItem(BaseModel):
    id: int | None = None
    endereco: str
    tipo: str = "secundario"  # 'principal' | 'secundario'
    ativo: int = 1
    contato_id: int | None = None


class ContatoItem(BaseModel):
    id: int | None = None
    nome: str
    cargo: str | None = None
    telefone: str | None = None
    is_principal: int = 0


class EmpresaCreateUpdate(BaseModel):
    nome: str
    responsavel_principal: str | None = None
    status: str = "ativo"
    observacoes: str | None = None
    backup_em_falha: int = 0
    tipos_backup: list[str] = []
    contatos: list[ContatoItem] = []
    emails: list[EmailItem] = []


class ToggleFalhaPayload(BaseModel):
    em_falha: bool
    motivo: str = "Não troca do disco"
    tipo_backup: str = "Semanal"
    descricao: str | None = None


class ToggleBackupTypePayload(BaseModel):
    tipo: str
    ativo: bool


@router.get("")
def list_clients(
    busca: str | None = None,
    status: str | None = None,
    tipo_backup: str | None = None,
    em_falha: bool | None = None,
):
    with get_db() as db:
        query = """
            SELECT 
                e.*,
                (SELECT endereco FROM emails WHERE empresa_id = e.id AND tipo = 'principal' AND ativo = 1 LIMIT 1) as email_principal,
                (SELECT COUNT(*) FROM emails WHERE empresa_id = e.id AND ativo = 1) as total_emails,
                (SELECT datetime_previsto FROM agendamentos WHERE empresa_id = e.id AND status = 'agendado' ORDER BY datetime_previsto ASC LIMIT 1) as proximo_agendamento
            FROM empresas e
            WHERE 1=1
        """
        params = []

        if busca:
            query += " AND (e.nome LIKE ? OR e.responsavel_principal LIKE ? OR e.id IN (SELECT empresa_id FROM emails WHERE endereco LIKE ?))"
            b_val = f"%{busca}%"
            params.extend([b_val, b_val, b_val])

        if status:
            query += " AND e.status = ?"
            params.append(status)

        if em_falha is not None:
            query += " AND e.backup_em_falha = ?"
            params.append(1 if em_falha else 0)

        query += " ORDER BY e.nome ASC"

        rows = db.execute(query, params).fetchall()
        result = []

        for row in rows:
            emp = dict(row)
            emp_id = emp["id"]

            # Tipos de backup ativos
            tb_rows = db.execute("SELECT tipo FROM tipos_backup WHERE empresa_id = ? AND ativo = 1", (emp_id,)).fetchall()
            emp["tipos_backup"] = [t["tipo"] for t in tb_rows]

            # Se filtrado por tipo_backup, aplica filtro
            if tipo_backup and tipo_backup not in emp["tipos_backup"]:
                continue

            result.append(emp)

        return result


@router.get("/{id}")
def get_client_details(id: int):
    with get_db() as db:
        emp_row = db.execute("SELECT * FROM empresas WHERE id = ?", (id,)).fetchone()
        if not emp_row:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        empresa = dict(emp_row)

        # Tipos de backup (todos os suportados com flag de ativo)
        tb_rows = db.execute("SELECT tipo, ativo FROM tipos_backup WHERE empresa_id = ?", (id,)).fetchall()
        tb_map = {r["tipo"]: bool(r["ativo"]) for r in tb_rows}
        all_types = ["diario", "semanal", "mensal", "anual", "cloud"]
        empresa["tipos_backup_detalhes"] = [{"tipo": t, "ativo": tb_map.get(t, False)} for t in all_types]
        empresa["tipos_backup"] = [t for t, active in tb_map.items() if active]

        # Contatos
        c_rows = db.execute("SELECT * FROM contatos WHERE empresa_id = ? ORDER BY is_principal DESC, nome ASC", (id,)).fetchall()
        empresa["contatos"] = [dict(r) for r in c_rows]

        # E-mails com nome do contato associado
        e_rows = db.execute("""
            SELECT e.*, c.nome as contato_nome
            FROM emails e
            LEFT JOIN contatos c ON e.contato_id = c.id
            WHERE e.empresa_id = ?
            ORDER BY (CASE WHEN e.tipo = 'principal' THEN 0 ELSE 1 END), e.endereco ASC
        """, (id,)).fetchall()
        empresa["emails"] = [dict(r) for r in e_rows]

        # Falha ativa se houver
        falha_ativa = db.execute("""
            SELECT * FROM falhas WHERE empresa_id = ? AND status = 'em_falha' ORDER BY data_registro DESC LIMIT 1
        """, (id,)).fetchone()
        empresa["falha_ativa"] = dict(falha_ativa) if falha_ativa else None

        # Agendamentos futuros
        ag_rows = db.execute("""
            SELECT a.*, COALESCE(t.nome, 'Personalizado') as template_nome
            FROM agendamentos a
            LEFT JOIN templates t ON a.template_id = t.id
            WHERE a.empresa_id = ? AND a.status = 'agendado'
            ORDER BY a.datetime_previsto ASC
        """, (id,)).fetchall()
        empresa["agendamentos"] = [dict(r) for r in ag_rows]

        # Histórico recente de envios
        env_rows = db.execute("""
            SELECT * FROM emails_enviados
            WHERE empresa_id = ?
            ORDER BY data_envio DESC
            LIMIT 10
        """, (id,)).fetchall()
        empresa["historico_envios"] = [dict(r) for r in env_rows]

        return empresa


@router.post("")
def create_client(data: EmpresaCreateUpdate):
    with get_db() as db:
        # Check if already exists
        existing = db.execute("SELECT id FROM empresas WHERE nome = ?", (data.nome,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Já existe uma empresa com este nome.")

        cursor = db.execute("""
            INSERT INTO empresas (nome, responsavel_principal, status, observacoes, backup_em_falha)
            VALUES (?, ?, ?, ?, ?)
        """, (data.nome, data.responsavel_principal, data.status, data.observacoes, data.backup_em_falha))
        empresa_id = cursor.lastrowid

        # Insere tipos de backup
        for tb in data.tipos_backup:
            db.execute("INSERT INTO tipos_backup (empresa_id, tipo, ativo) VALUES (?, ?, 1)", (empresa_id, tb))

        # Insere contatos
        contato_id_map = {}
        for c in data.contatos:
            c_cur = db.execute("""
                INSERT INTO contatos (empresa_id, nome, cargo, telefone, is_principal)
                VALUES (?, ?, ?, ?, ?)
            """, (empresa_id, c.nome, c.cargo, c.telefone, c.is_principal))
            if c.nome:
                contato_id_map[c.nome] = c_cur.lastrowid

        # Insere e-mails
        for e in data.emails:
            c_id = e.contato_id or (contato_id_map.get(data.responsavel_principal) if data.responsavel_principal else None)
            db.execute("""
                INSERT INTO emails (empresa_id, contato_id, endereco, tipo, ativo)
                VALUES (?, ?, ?, ?, ?)
            """, (empresa_id, c_id, e.endereco.strip().lower(), e.tipo, e.ativo))

        log_auditoria("EMPRESAS", empresa_id, "CRIAR_EMPRESA", f"Empresa '{data.nome}' criada com sucesso.", db=db)

    # IMPORTANTE: get_client_details abre sua PRÓPRIA conexão. Chamá-la só depois
    # que o bloco `with get_db()` acima já foi fechado (e a transação, commitada)
    # evita que essa segunda conexão não veja a escrita ainda não commitada (ou
    # trave disputando o lock de escrita em journal_mode=WAL).
    return get_client_details(empresa_id)


@router.put("/{id}")
def update_client(id: int, data: EmpresaCreateUpdate):
    with get_db() as db:
        db.execute("""
            UPDATE empresas
            SET nome = ?, responsavel_principal = ?, status = ?, observacoes = ?,
                backup_em_falha = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (data.nome, data.responsavel_principal, data.status, data.observacoes, data.backup_em_falha, id))

        # Atualiza tipos de backup
        all_types = ["diario", "semanal", "mensal", "anual", "cloud"]
        for tb in all_types:
            is_active = 1 if tb in data.tipos_backup else 0
            db.execute("""
                INSERT INTO tipos_backup (empresa_id, tipo, ativo)
                VALUES (?, ?, ?)
                ON CONFLICT(empresa_id, tipo) DO UPDATE SET ativo = ?
            """, (id, tb, is_active, is_active))

        # Se informado lista de contatos, sincroniza
        if data.contatos is not None:
            # Mantém contatos ou insere novos
            db.execute("DELETE FROM contatos WHERE empresa_id = ?", (id,))
            for c in data.contatos:
                db.execute("""
                    INSERT INTO contatos (empresa_id, nome, cargo, telefone, is_principal)
                    VALUES (?, ?, ?, ?, ?)
                """, (id, c.nome, c.cargo, c.telefone, c.is_principal))

        # Se informado lista de e-mails, sincroniza
        if data.emails is not None:
            db.execute("DELETE FROM emails WHERE empresa_id = ?", (id,))
            for e in data.emails:
                if e.endereco.strip():
                    db.execute("""
                        INSERT INTO emails (empresa_id, contato_id, endereco, tipo, ativo)
                        VALUES (?, ?, ?, ?, ?)
                    """, (id, e.contato_id, e.endereco.strip().lower(), e.tipo, e.ativo))

        log_auditoria("EMPRESAS", id, "ATUALIZAR_EMPRESA", f"Empresa '{data.nome}' atualizada.", db=db)

    # Ver comentário equivalente em create_client sobre por que essa chamada
    # precisa ficar fora do `with get_db()` acima.
    return get_client_details(id)


@router.delete("/{id}")
def delete_client(id: int):
    with get_db() as db:
        emp = db.execute("SELECT nome FROM empresas WHERE id = ?", (id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        nome = emp["nome"]
        db.execute("DELETE FROM empresas WHERE id = ?", (id,))
        log_auditoria("EMPRESAS", id, "EXCLUIR_EMPRESA", f"Empresa '{nome}' removida.", db=db)
        return {"sucesso": True, "mensagem": f"Empresa '{nome}' excluída com sucesso."}


@router.post("/{id}/emails")
def add_client_email(id: int, payload: EmailItem):
    addr = payload.endereco.strip().lower()
    if not addr:
        raise HTTPException(status_code=400, detail="Endereço de e-mail inválido.")

    with get_db() as db:
        emp = db.execute("SELECT id, nome FROM empresas WHERE id = ?", (id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        # Se for marcado como principal, desmarca os outros
        if payload.tipo == "principal":
            db.execute("UPDATE emails SET tipo = 'secundario' WHERE empresa_id = ?", (id,))

        cursor = db.execute("""
            INSERT INTO emails (empresa_id, contato_id, endereco, tipo, ativo)
            VALUES (?, ?, ?, ?, ?)
        """, (id, payload.contato_id, addr, payload.tipo, payload.ativo))
        email_id = cursor.lastrowid
        log_auditoria("EMAILS", email_id, "ADICIONAR_EMAIL", f"E-mail '{addr}' ({payload.tipo}) adicionado para empresa #{id}.", db=db)
    
    return get_client_details(id)


@router.put("/{id}/emails/{email_id}")
def update_client_email(id: int, email_id: int, payload: EmailItem):
    addr = payload.endereco.strip().lower()
    if not addr:
        raise HTTPException(status_code=400, detail="Endereço de e-mail inválido.")

    with get_db() as db:
        emp = db.execute("SELECT id FROM empresas WHERE id = ?", (id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        if payload.tipo == "principal":
            db.execute("UPDATE emails SET tipo = 'secundario' WHERE empresa_id = ?", (id,))

        db.execute("""
            UPDATE emails
            SET endereco = ?, tipo = ?, ativo = ?, contato_id = ?
            WHERE id = ? AND empresa_id = ?
        """, (addr, payload.tipo, payload.ativo, payload.contato_id, email_id, id))
        log_auditoria("EMAILS", email_id, "ATUALIZAR_EMAIL", f"E-mail #{email_id} atualizado para '{addr}' ({payload.tipo}).", db=db)

    return get_client_details(id)


@router.delete("/{id}/emails/{email_id}")
def delete_client_email(id: int, email_id: int):
    with get_db() as db:
        db.execute("DELETE FROM emails WHERE id = ? AND empresa_id = ?", (email_id, id))
        log_auditoria("EMAILS", email_id, "EXCLUIR_EMAIL", f"E-mail #{email_id} removido da empresa #{id}.", db=db)

    return get_client_details(id)


@router.post("/{id}/emails/{email_id}/set-principal")
def set_client_email_principal(id: int, email_id: int):
    with get_db() as db:
        db.execute("UPDATE emails SET tipo = 'secundario' WHERE empresa_id = ?", (id,))
        db.execute("UPDATE emails SET tipo = 'principal' WHERE id = ? AND empresa_id = ?", (email_id, id))
        log_auditoria("EMAILS", email_id, "DEFINIR_PRINCIPAL", f"E-mail #{email_id} definido como principal da empresa #{id}.", db=db)

    return get_client_details(id)


@router.post("/{id}/toggle-falha")
def toggle_falha(id: int, payload: ToggleFalhaPayload):
    with get_db() as db:
        emp = db.execute("SELECT nome FROM empresas WHERE id = ?", (id,)).fetchone()
        if not emp:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        nome = emp["nome"]

        novo_status = 1 if payload.em_falha else 0
        db.execute("UPDATE empresas SET backup_em_falha = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (novo_status, id))

        if payload.em_falha:
            tipo_backup_norm = normalizar_tipo_backup(payload.tipo_backup)
            # Registra incidente de falha
            db.execute("""
                INSERT INTO falhas (empresa_id, tipo_backup, motivo, descricao, status, data_registro)
                VALUES (?, ?, ?, ?, 'em_falha', CURRENT_TIMESTAMP)
            """, (id, tipo_backup_norm, payload.motivo, payload.descricao))
            log_auditoria("FALHAS", id, "REGISTRAR_FALHA", f"Falha de backup ativada para {nome}: {payload.motivo} ({tipo_backup_norm})", db=db)
        else:
            # Resolve falhas abertas
            db.execute("""
                UPDATE falhas
                SET status = 'resolvida', data_resolucao = CURRENT_TIMESTAMP
                WHERE empresa_id = ? AND status = 'em_falha'
            """, (id,))
            log_auditoria("FALHAS", id, "RESOLVER_FALHA", f"Falha de backup normalizada para {nome}", db=db)

        return {"sucesso": True, "backup_em_falha": novo_status}


@router.post("/{id}/toggle-backup-type")
def toggle_backup_type(id: int, payload: ToggleBackupTypePayload):
    with get_db() as db:
        val = 1 if payload.ativo else 0
        db.execute("""
            INSERT INTO tipos_backup (empresa_id, tipo, ativo)
            VALUES (?, ?, ?)
            ON CONFLICT(empresa_id, tipo) DO UPDATE SET ativo = ?
        """, (id, payload.tipo, val, val))
        return {"sucesso": True, "tipo": payload.tipo, "ativo": payload.ativo}


@router.post("/import/preview")
async def preview_import(arquivo: UploadFile | None = None):
    temp_path = None
    if arquivo:
        temp_dir = Path(__file__).resolve().parent.parent / "temp"
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / arquivo.filename
        with open(temp_path, "wb") as f:
            content = await arquivo.read()
            f.write(content)

    res = preview_excel_file(temp_path)
    if temp_path and temp_path.exists():
        try:
            temp_path.unlink()
        except Exception:
            pass
    return res


@router.post("/import/confirm")
async def confirm_import(arquivo: UploadFile | None = None, overwrite: bool = Form(False)):
    temp_path = None
    if arquivo:
        temp_dir = Path(__file__).resolve().parent.parent / "temp"
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / arquivo.filename
        with open(temp_path, "wb") as f:
            content = await arquivo.read()
            f.write(content)

    res = import_excel_data(temp_path, overwrite=overwrite)
    if temp_path and temp_path.exists():
        try:
            temp_path.unlink()
        except Exception:
            pass
    return res
