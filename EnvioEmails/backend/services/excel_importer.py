import re
from pathlib import Path
import openpyxl
from database import get_db, log_auditoria

EXCEL_DEFAULT_PATH = Path(__file__).resolve().parent.parent.parent / "Bancos" / "cadastro_clientes.xlsx"
_EMAIL_RE = re.compile(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)")
_NAME_EMAIL_RE = re.compile(r"['\"]?([^'\"<]+?)['\"]?\s*<([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>")


def parse_email_cell(cell_value: str | None) -> list[dict]:
    """Extrai lista de contatos/e-mails a partir de uma célula de texto."""
    if not cell_value:
        return []
    
    raw_str = str(cell_value).replace("\n", ";").replace(",", ";")
    tokens = [t.strip() for t in raw_str.split(";") if t.strip()]
    
    results = []
    seen_emails = set()
    
    for token in tokens:
        # Check name <email> format
        m_name = _NAME_EMAIL_RE.search(token)
        if m_name:
            nome = m_name.group(1).strip()
            email = m_name.group(2).strip().lower()
        else:
            m_email = _EMAIL_RE.search(token)
            if not m_email:
                continue
            email = m_email.group(1).strip().lower()
            # Try to derive name from email prefix or raw token
            prefix = email.split("@")[0].replace(".", " ").replace("_", " ").title()
            nome = prefix

        # Clean trailing quotes or spaces
        email = email.rstrip("'\"").lstrip("'\"")
        if email and email not in seen_emails:
            seen_emails.add(email)
            results.append({
                "nome": nome,
                "email": email,
                "tipo": "principal" if len(results) == 0 else "secundario",
            })
            
    return results


def preview_excel_file(file_path: Path | str | None = None) -> dict:
    """Lê o arquivo Excel e gera um resumo prévio antes da importação definitiva."""
    path = Path(file_path) if file_path else EXCEL_DEFAULT_PATH
    if not path.exists():
        return {
            "error": f"Arquivo não encontrado: {path}",
            "total_empresas": 0,
            "total_contatos": 0,
            "total_emails": 0,
            "empresas": [],
            "duplicidades": 0,
        }

    wb = openpyxl.load_workbook(path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {"error": "Arquivo vazio", "total_empresas": 0, "empresas": []}

    # Find columns
    header = [str(c).strip().lower() if c is not None else "" for c in rows[0]]
    cliente_col = 0
    emails_col = 1
    for idx, col in enumerate(header):
        if "cliente" in col or "empresa" in col or "nome" in col:
            cliente_col = idx
        elif "email" in col or "e-mail" in col:
            emails_col = idx

    empresas = []
    seen_names = set()
    duplicidades = 0
    total_emails = 0
    total_contatos = 0

    for row in rows[1:]:
        if not row or not row[cliente_col]:
            continue
        nome_empresa = str(row[cliente_col]).strip().upper()
        if not nome_empresa:
            continue

        raw_emails = row[emails_col] if len(row) > emails_col else None
        contatos_emails = parse_email_cell(raw_emails)

        if nome_empresa in seen_names:
            duplicidades += 1
        seen_names.add(nome_empresa)

        total_emails += len(contatos_emails)
        total_contatos += len(contatos_emails)

        empresas.append({
            "nome": nome_empresa,
            # Responsável e tipos de backup não constam no Excel de origem (só Cliente/Emails).
            # Ficam vazios aqui de propósito — a equipe de TI preenche manualmente após a importação.
            "responsavel_principal": "",
            "contatos_emails": contatos_emails,
            "tipos_backup": [],
        })

    return {
        "total_empresas": len(empresas),
        "total_contatos": total_contatos,
        "total_emails": total_emails,
        "duplicidades": duplicidades,
        "empresas": empresas,
    }


def import_excel_data(file_path: Path | str | None = None, overwrite: bool = False) -> dict:
    """Importa os dados reais do Excel para o banco de dados relacional."""
    preview = preview_excel_file(file_path)
    if "error" in preview:
        return {"sucesso": False, "mensagem": preview["error"]}

    with get_db() as db:
        if overwrite:
            db.execute("DELETE FROM empresas")
            db.execute("DELETE FROM contatos")
            db.execute("DELETE FROM emails")
            db.execute("DELETE FROM tipos_backup")

        adicionadas = 0
        atualizadas = 0

        for item in preview["empresas"]:
            nome = item["nome"]
            resp = item["responsavel_principal"]

            cursor = db.execute("SELECT id FROM empresas WHERE nome = ?", (nome,))
            row = cursor.fetchone()

            if row:
                empresa_id = row["id"]
                db.execute(
                    "UPDATE empresas SET responsavel_principal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (resp, empresa_id)
                )
                atualizadas += 1
            else:
                cursor = db.execute(
                    "INSERT INTO empresas (nome, responsavel_principal, status, backup_em_falha) VALUES (?, ?, 'ativo', 0)",
                    (nome, resp)
                )
                empresa_id = cursor.lastrowid
                adicionadas += 1

            # Insere / atualiza contatos e emails
            for ce in item["contatos_emails"]:
                # Check email exists for company
                c_email = db.execute(
                    "SELECT id FROM emails WHERE empresa_id = ? AND endereco = ?",
                    (empresa_id, ce["email"])
                ).fetchone()

                if not c_email:
                    # Create contato
                    c_cursor = db.execute(
                        "INSERT INTO contatos (empresa_id, nome, is_principal) VALUES (?, ?, ?)",
                        (empresa_id, ce["nome"], 1 if ce["tipo"] == "principal" else 0)
                    )
                    contato_id = c_cursor.lastrowid

                    db.execute(
                        "INSERT INTO emails (empresa_id, contato_id, endereco, tipo, ativo) VALUES (?, ?, ?, ?, 1)",
                        (empresa_id, contato_id, ce["email"], ce["tipo"])
                    )

            # Insere tipos de backup padrão se não existirem
            padrao_tipos = item["tipos_backup"] if item.get("tipos_backup") else ["diario", "semanal", "mensal", "cloud", "anual"]
            for tb in padrao_tipos:
                db.execute(
                    "INSERT OR IGNORE INTO tipos_backup (empresa_id, tipo, ativo) VALUES (?, ?, 1)",
                    (empresa_id, tb)
                )

        log_auditoria("IMPORTACAO", None, "IMPORTAR_EXCEL", f"Importação de {adicionadas} adicionadas, {atualizadas} atualizadas.", db=db)


    return {
        "sucesso": True,
        "total_empresas": preview["total_empresas"],
        "adicionadas": adicionadas,
        "atualizadas": atualizadas,
        "total_emails": preview["total_emails"],
    }


def seed_templates_if_empty():
    """Popula os templates iniciais a partir do arquivo tipos_de_email.json se a tabela estiver vazia."""
    import json
    templates_json = Path(__file__).resolve().parent.parent / "tipos_de_email.json"
    if not templates_json.exists():
        return

    with get_db() as db:
        count = db.execute("SELECT COUNT(*) as cnt FROM templates").fetchone()["cnt"]
        if count > 0:
            return

        with open(templates_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        for chave, tpl in data.items():
            assunto = tpl.get("assunto", "").replace("{cliente}", "{{empresa}}")
            nome = tpl.get("titulo", chave.replace("_", " ").title())
            categoria = tpl.get("categoria", "info")
            estilo = tpl.get("estilo", "marca")
            aplicavel_a = tpl.get("aplicavel_a", [])
            # Mantém tipo_backup_relacionado (campo legado, único) como o primeiro item,
            # mas aplicavel_a (nova coluna) preserva a lista completa vinda da origem.
            tipo_backup = aplicavel_a[0] if aplicavel_a else "geral"
            corpo = tpl.get("corpo", [])

            # Gera HTML base
            corpo_html = "\n".join([f"<p style='margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;'>{p.replace('{cliente}', '{{empresa}}')}</p>" for p in corpo])

            db.execute("""
                INSERT INTO templates (chave, nome, categoria, finalidade, tipo_backup_relacionado, aplicavel_a, assunto, html_content, corpo_json, estilo, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')
            """, (
                chave,
                nome,
                categoria,
                f"Comunicação para rotinas de backup {tipo_backup}",
                tipo_backup,
                json.dumps(aplicavel_a, ensure_ascii=False),
                assunto,
                corpo_html,
                json.dumps(corpo, ensure_ascii=False),
                estilo
            ))
        log_auditoria("TEMPLATES", None, "SEED_INICIAL", "Templates padrão importados no banco de dados.", db=db)

