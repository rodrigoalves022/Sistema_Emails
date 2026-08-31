import re
import json
from datetime import datetime
from database import get_db, log_auditoria
from services import settings_store
from jinja2 import Environment, FileSystemLoader
from config import TEMPLATES_DIR

_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)

ACCENTS = {
    "marca": {
        "bar": "linear-gradient(90deg, #8DC63F 0%, #00B39B 50%, #00AEEF 100%)",
        "solid": "#00B39B",
    },
    "alerta": {
        "bar": "#E5572D",
        "solid": "#E5572D",
    },
    "sucesso": {
        "bar": "linear-gradient(90deg, #8DC63F 0%, #00B39B 100%)",
        "solid": "#00B39B",
    },
    "info": {
        "bar": "linear-gradient(90deg, #00AEEF 0%, #00B39B 100%)",
        "solid": "#00AEEF",
    },
}


def get_available_variables() -> list[dict]:
    """Retorna a lista de variáveis disponíveis para uso nos templates."""
    return [
        {"variavel": "{{empresa}}", "descricao": "Nome da empresa/cliente", "exemplo": "BURITI CACOAL"},
        {"variavel": "{{responsavel}}", "descricao": "Nome do responsável principal", "exemplo": "Bruno Santos"},
        {"variavel": "{{tipo_backup}}", "descricao": "Tipo de backup em execução", "exemplo": "Semanal"},
        {"variavel": "{{data}}", "descricao": "Data atual ou da rotina (DD/MM/AAAA)", "exemplo": datetime.now().strftime("%d/%m/%Y")},
        {"variavel": "{{horario}}", "descricao": "Horário limite ou previsto", "exemplo": "16:30"},
        {"variavel": "{{contato}}", "descricao": "Nome do contato destinatário", "exemplo": "João Silva"},
        {"variavel": "{{nome_cliente}}", "descricao": "Alias para o nome da empresa", "exemplo": "BURITI CACOAL"},
    ]


def replace_template_variables(text: str, context: dict) -> str:
    """Substitui variáveis nos padrões {{var}}, {var}."""
    if not text:
        return ""
    
    empresa = context.get("empresa", "")
    responsavel = context.get("responsavel", "")
    tipo_backup = context.get("tipo_backup", "")
    data = context.get("data", datetime.now().strftime("%d/%m/%Y"))
    horario = context.get("horario", "16:30")
    contato = context.get("contato", responsavel or empresa)
    nome_cliente = context.get("nome_cliente", empresa)

    mapping = {
        "empresa": empresa,
        "responsavel": responsavel,
        "tipo_backup": tipo_backup,
        "data": data,
        "horario": horario,
        "contato": contato,
        "nome_cliente": nome_cliente,
        "cliente": empresa,
    }

    res = text
    for k, v in mapping.items():
        # Replace {{key}}
        res = re.sub(rf"\{{\{{\s*{k}\s*\}}\}}", str(v), res, flags=re.IGNORECASE)
        # Replace {key}
        res = re.sub(rf"\{{\s*{k}\s*\}}", str(v), res, flags=re.IGNORECASE)
    
    return res


def _decode_row(row: dict) -> dict:
    """Decodifica campos armazenados como JSON (ex.: aplicavel_a) para uso em memória."""
    raw = row.get("aplicavel_a")
    if raw:
        try:
            row["aplicavel_a"] = json.loads(raw)
        except (TypeError, ValueError):
            row["aplicavel_a"] = []
    else:
        row["aplicavel_a"] = []
    return row


def list_templates() -> list[dict]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM templates ORDER BY nome ASC").fetchall()
        return [_decode_row(dict(r)) for r in rows]


def get_template_by_id_or_key(identifier: str | int) -> dict | None:
    with get_db() as db:
        if str(identifier).isdigit():
            row = db.execute("SELECT * FROM templates WHERE id = ?", (int(identifier),)).fetchone()
        else:
            row = db.execute("SELECT * FROM templates WHERE chave = ?", (str(identifier),)).fetchone()
        return _decode_row(dict(row)) if row else None


def save_template(data: dict) -> dict:
    chave = data.get("chave", "").strip()
    nome = data.get("nome", "").strip()
    categoria = data.get("categoria", "info")
    finalidade = data.get("finalidade", "")
    tipo_backup = data.get("tipo_backup_relacionado", "geral")
    aplicavel_a = data.get("aplicavel_a") or []
    aplicavel_a_json = json.dumps(aplicavel_a, ensure_ascii=False)
    assunto = data.get("assunto", "")
    html_content = data.get("html_content", "")
    corpo_json = data.get("corpo_json", "[]")
    estilo = data.get("estilo", "marca")
    status = data.get("status", "ativo")

    with get_db() as db:
        if "id" in data and data["id"]:
            db.execute("""
                UPDATE templates SET
                    nome = ?, categoria = ?, finalidade = ?, tipo_backup_relacionado = ?, aplicavel_a = ?,
                    assunto = ?, html_content = ?, corpo_json = ?, estilo = ?, status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (nome, categoria, finalidade, tipo_backup, aplicavel_a_json, assunto, html_content, corpo_json, estilo, status, data["id"]))
            tpl_id = data["id"]
            log_auditoria("TEMPLATES", tpl_id, "ATUALIZAR_TEMPLATE", f"Template '{nome}' atualizado.", db=db)
        else:
            cursor = db.execute("""
                INSERT INTO templates (chave, nome, categoria, finalidade, tipo_backup_relacionado, aplicavel_a, assunto, html_content, corpo_json, estilo, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (chave, nome, categoria, finalidade, tipo_backup, aplicavel_a_json, assunto, html_content, corpo_json, estilo, status))
            tpl_id = cursor.lastrowid
            log_auditoria("TEMPLATES", tpl_id, "CRIAR_TEMPLATE", f"Template '{nome}' criado.", db=db)

        # IMPORTANTE: lê o registro recém-gravado usando a MESMA conexão/transação
        # (db), em vez de abrir uma nova conexão via get_template_by_id_or_key.
        # Uma segunda conexão não veria a escrita ainda não commitada (e, em
        # journal_mode=WAL, disputaria o lock de escrita com esta transação
        # ainda aberta, travando por até o timeout de conexão).
        row = db.execute("SELECT * FROM templates WHERE id = ?", (tpl_id,)).fetchone()
        return _decode_row(dict(row)) if row else None


def render_template_email(
    template_data: dict,
    context: dict,
    preview_mode: bool = False
) -> tuple[str, str]:
    """Retorna (assunto_processado, html_final)."""
    assunto = replace_template_variables(template_data.get("assunto", ""), context)
    raw_html = template_data.get("html_content", "")
    estilo = template_data.get("estilo", "marca")
    accent = ACCENTS.get(estilo, ACCENTS["marca"])
    cfg = settings_store.load_settings()

    # Se o template tiver tags completas <html> ou <table> com layout, faz o replace direto
    if "<html" in raw_html.lower() or "<body" in raw_html.lower():
        html_final = replace_template_variables(raw_html, context)
    else:
        # Usa o base_email.html e injeta o html_content
        corpo_processado = replace_template_variables(raw_html, context)
        base_template = _env.get_template("base_email.html")
        html_final = base_template.render(
            titulo=replace_template_variables(template_data.get("nome", ""), context),
            cliente_nome=context.get("responsavel") or context.get("empresa", ""),
            paragrafos=[corpo_processado],
            accent_bar=accent["bar"],
            accent_solid=accent["solid"],
            signature_company=cfg.get("signature_company", "Core TI Expert"),
            signature_dept=cfg.get("signature_dept", "Departamento de Backup"),
            signature_phone=cfg.get("signature_phone", "(62) 3242-5830"),
            signature_email=cfg.get("signature_email", "clientes.backup@coretiexpert.com.br"),
            preview_mode=preview_mode,
        )

    return assunto, html_final
