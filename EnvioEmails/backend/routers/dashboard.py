from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats():
    with get_db() as db:
        # Indicadores gerais
        total_clientes = db.execute("SELECT COUNT(*) as cnt FROM empresas").fetchone()["cnt"]
        clientes_ativos = db.execute("SELECT COUNT(*) as cnt FROM empresas WHERE status = 'ativo'").fetchone()["cnt"]
        clientes_em_falha = db.execute("SELECT COUNT(*) as cnt FROM empresas WHERE backup_em_falha = 1").fetchone()["cnt"]
        
        emails_hoje = db.execute("""
            SELECT COUNT(*) as cnt FROM emails_enviados 
            WHERE date(data_envio, 'localtime') = date('now', 'localtime')
        """).fetchone()["cnt"]
        
        emails_agendados = db.execute("SELECT COUNT(*) as cnt FROM agendamentos WHERE status = 'agendado'").fetchone()["cnt"]
        emails_sucesso = db.execute("SELECT COUNT(*) as cnt FROM emails_enviados WHERE status = 'sucesso'").fetchone()["cnt"]
        emails_erro = db.execute("SELECT COUNT(*) as cnt FROM emails_enviados WHERE status = 'erro'").fetchone()["cnt"]
        
        falhas_troca_disco = db.execute("""
            SELECT COUNT(*) as cnt FROM falhas 
            WHERE status = 'em_falha' AND (motivo LIKE '%disco%' OR motivo LIKE '%troca%')
        """).fetchone()["cnt"]

        # Próximos agendamentos
        proximos = db.execute("""
            SELECT 
                a.id,
                a.datetime_previsto,
                a.tipo_backup,
                a.tipo_email,
                a.status,
                e.nome as empresa_nome,
                COALESCE(t.nome, 'Personalizado') as template_nome
            FROM agendamentos a
            JOIN empresas e ON a.empresa_id = e.id
            LEFT JOIN templates t ON a.template_id = t.id
            WHERE a.status = 'agendado'
            ORDER BY a.datetime_previsto ASC
            LIMIT 8
        """).fetchall()

        # Clientes em falha (área de atenção operacional)
        alertas_falhas = db.execute("""
            SELECT 
                f.id,
                f.empresa_id,
                f.tipo_backup,
                f.motivo,
                f.data_registro,
                f.ultimo_email_enviado,
                e.nome as empresa_nome,
                e.responsavel_principal,
                (SELECT endereco FROM emails WHERE empresa_id = e.id AND tipo = 'principal' LIMIT 1) as email_principal
            FROM falhas f
            JOIN empresas e ON f.empresa_id = e.id
            WHERE f.status = 'em_falha'
            ORDER BY f.data_registro DESC
            LIMIT 10
        """).fetchall()

        return {
            "indicadores": {
                "total_clientes": total_clientes,
                "clientes_ativos": clientes_ativos,
                "clientes_em_falha": clientes_em_falha,
                "emails_hoje": emails_hoje,
                "emails_agendados": emails_agendados,
                "emails_sucesso": emails_sucesso,
                "emails_erro": emails_erro,
                "falhas_troca_disco": falhas_troca_disco,
            },
            "proximos_agendamentos": [dict(r) for r in proximos],
            "alertas_falhas": [dict(r) for r in alertas_falhas],
        }
