import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "backup_emails.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_auditoria(entidade: str, entidade_id: int | None, acao: str, detalhes: str = "", usuario: str = "sistema", db = None):
    """Registra uma ação no histórico de auditoria. Se uma conexão `db` já estiver aberta, reutiliza-a."""
    query = """
        INSERT INTO auditoria (entidade, entidade_id, acao, detalhes, usuario, data_hora)
        VALUES (?, ?, ?, ?, ?, ?)
    """
    params = (entidade, entidade_id, acao, detalhes, usuario, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    try:
        if db is not None:
            db.execute(query, params)
        else:
            with get_db() as local_db:
                local_db.execute(query, params)
    except Exception as e:
        print(f"Erro ao registrar auditoria: {e}")


def init_db():
    """Inicializa as tabelas do banco de dados relacional se não existirem."""
    with get_db() as db:
        # 1. Empresas
        db.execute("""
            CREATE TABLE IF NOT EXISTS empresas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'ativo',
                responsavel_principal TEXT,
                observacoes TEXT,
                backup_em_falha INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Contatos
        db.execute("""
            CREATE TABLE IF NOT EXISTS contatos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                nome TEXT NOT NULL,
                cargo TEXT,
                telefone TEXT,
                is_principal INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. Emails
        db.execute("""
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                contato_id INTEGER REFERENCES contatos(id) ON DELETE SET NULL,
                endereco TEXT NOT NULL,
                tipo TEXT DEFAULT 'secundario',
                ativo INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 4. Tipos de Backup
        db.execute("""
            CREATE TABLE IF NOT EXISTS tipos_backup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                tipo TEXT NOT NULL,
                ativo INTEGER DEFAULT 1,
                UNIQUE(empresa_id, tipo)
            )
        """)

        # 5. Falhas
        db.execute("""
            CREATE TABLE IF NOT EXISTS falhas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                tipo_backup TEXT,
                motivo TEXT NOT NULL,
                descricao TEXT,
                status TEXT DEFAULT 'em_falha',
                data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_resolucao TIMESTAMP,
                ultimo_email_enviado TIMESTAMP,
                proximo_email_agendado TIMESTAMP
            )
        """)

        # 6. Templates
        db.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chave TEXT UNIQUE NOT NULL,
                nome TEXT NOT NULL,
                categoria TEXT DEFAULT 'info',
                finalidade TEXT,
                tipo_backup_relacionado TEXT,
                assunto TEXT NOT NULL,
                html_content TEXT NOT NULL,
                corpo_json TEXT,
                estilo TEXT DEFAULT 'marca',
                status TEXT DEFAULT 'ativo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 7. Agendamentos
        db.execute("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                tipo_backup TEXT,
                tipo_email TEXT,
                template_id INTEGER REFERENCES templates(id),
                custom_assunto TEXT,
                custom_html TEXT,
                datetime_previsto TEXT NOT NULL,
                destinatario_principal TEXT NOT NULL,
                bcc_emails TEXT,
                status TEXT DEFAULT 'agendado',
                erro TEXT,
                retries INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 8. Emails Enviados (Histórico)
        db.execute("""
            CREATE TABLE IF NOT EXISTS emails_enviados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
                empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
                tipo_backup TEXT,
                tipo_email TEXT,
                template_id INTEGER,
                assunto TEXT NOT NULL,
                destinatario_principal TEXT NOT NULL,
                bcc_emails TEXT,
                status TEXT NOT NULL,
                erro TEXT,
                data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 9. Auditoria
        db.execute("""
            CREATE TABLE IF NOT EXISTS auditoria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entidade TEXT NOT NULL,
                entidade_id INTEGER,
                acao TEXT NOT NULL,
                detalhes TEXT,
                usuario TEXT DEFAULT 'sistema',
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 10. Configurações
        db.execute("""
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT
            )
        """)

        # Indexes
        db.execute("CREATE INDEX IF NOT EXISTS idx_empresas_status ON empresas(status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_empresas_falha ON empresas(backup_em_falha)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_emails_empresa ON emails(empresa_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_tipos_backup_empresa ON tipos_backup(empresa_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status, datetime_previsto)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_falhas_status ON falhas(status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_emails_enviados_data ON emails_enviados(data_envio)")

        # Migrações leves e idempotentes de colunas adicionadas após a criação inicial das tabelas.
        _add_column_if_missing(db, "templates", "aplicavel_a", "TEXT")
        _add_column_if_missing(db, "emails_enviados", "html_content", "TEXT")

        # Backfill único e idempotente: templates seedados antes da coluna aplicavel_a
        # existir ficam com aplicavel_a NULL. Preenche com o próprio
        # tipo_backup_relacionado já gravado na linha (não fabrica dado novo,
        # só espelha em lista o valor único que já existia).
        db.execute("""
            UPDATE templates
            SET aplicavel_a = '["' || tipo_backup_relacionado || '"]'
            WHERE (aplicavel_a IS NULL OR aplicavel_a = '')
              AND tipo_backup_relacionado IS NOT NULL
              AND tipo_backup_relacionado NOT IN ('', 'geral')
        """)


def _add_column_if_missing(db, table: str, column: str, col_type: str):
    """Adiciona uma coluna a uma tabela existente se ela ainda não existir (migração idempotente)."""
    existing_cols = [row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in existing_cols:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
