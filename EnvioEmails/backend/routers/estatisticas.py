from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/estatisticas", tags=["Estatísticas Operacionais"])


@router.get("/falhas-por-empresa")
def get_falhas_por_empresa(data_inicio: str | None = None, data_fim: str | None = None):
    with get_db() as db:
        # Condição de data aplicada dentro de CASE/subqueries (não no JOIN, para não
        # eliminar empresas sem falha nenhuma dentro do período).
        falha_cond = "1=1"
        envio_cond = "1=1"
        date_params = []
        if data_inicio:
            falha_cond += " AND date(f.data_registro) >= ?"
            envio_cond += " AND date(data_envio) >= ?"
            date_params.append(data_inicio)
        if data_fim:
            falha_cond += " AND date(f.data_registro) <= ?"
            envio_cond += " AND date(data_envio) <= ?"
            date_params.append(data_fim)

        rows = db.execute(f"""
            SELECT
                e.id as empresa_id,
                e.nome as empresa_nome,
                e.responsavel_principal,
                COUNT(CASE WHEN {falha_cond} THEN f.id END) as total_falhas,
                SUM(CASE WHEN (f.motivo LIKE '%disco%' OR f.motivo LIKE '%troca%') AND {falha_cond} THEN 1 ELSE 0 END) as falhas_troca_disco,
                (SELECT COUNT(*) FROM emails_enviados WHERE empresa_id = e.id AND {envio_cond}) as emails_enviados,
                MAX(CASE WHEN {falha_cond} THEN f.data_registro END) as ultima_falha,
                (SELECT MAX(data_envio) FROM emails_enviados WHERE empresa_id = e.id AND {envio_cond}) as ultimo_envio,
                (SELECT datetime_previsto FROM agendamentos WHERE empresa_id = e.id AND status = 'agendado' ORDER BY datetime_previsto ASC LIMIT 1) as proximo_agendamento
            FROM empresas e
            LEFT JOIN falhas f ON e.id = f.empresa_id
            GROUP BY e.id
            HAVING total_falhas > 0 OR emails_enviados > 0
            ORDER BY falhas_troca_disco DESC, total_falhas DESC, emails_enviados DESC
        """, date_params * 4).fetchall()
        return [dict(r) for r in rows]


@router.get("/motivos")
def get_falhas_por_motivo(data_inicio: str | None = None, data_fim: str | None = None):
    with get_db() as db:
        query = "SELECT COALESCE(motivo, 'Outro') as motivo, COUNT(*) as total FROM falhas WHERE 1=1"
        params = []
        if data_inicio:
            query += " AND date(data_registro) >= ?"
            params.append(data_inicio)
        if data_fim:
            query += " AND date(data_registro) <= ?"
            params.append(data_fim)
        query += " GROUP BY motivo ORDER BY total DESC"
        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]


@router.get("/por-tipo-backup")
def get_stats_tipo_backup(data_inicio: str | None = None, data_fim: str | None = None):
    with get_db() as db:
        query = """
            SELECT
                COALESCE(tipo_backup, 'Geral') as tipo_backup,
                COUNT(*) as total_envios,
                SUM(CASE WHEN status = 'sucesso' THEN 1 ELSE 0 END) as total_sucesso,
                SUM(CASE WHEN status = 'erro' THEN 1 ELSE 0 END) as total_erro
            FROM emails_enviados
            WHERE 1=1
        """
        params = []
        if data_inicio:
            query += " AND date(data_envio) >= ?"
            params.append(data_inicio)
        if data_fim:
            query += " AND date(data_envio) <= ?"
            params.append(data_fim)
        query += " GROUP BY tipo_backup ORDER BY total_envios DESC"
        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]


@router.get("/resumo-geral")
def get_resumo_geral(data_inicio: str | None = None, data_fim: str | None = None):
    with get_db() as db:
        falhas_filter = "1=1"
        envios_filter = "1=1"
        if data_inicio:
            falhas_filter += " AND date(data_registro) >= ?"
            envios_filter += " AND date(data_envio) >= ?"
        if data_fim:
            falhas_filter += " AND date(data_registro) <= ?"
            envios_filter += " AND date(data_envio) <= ?"

        f_params = []
        if data_inicio:
            f_params.append(data_inicio)
        if data_fim:
            f_params.append(data_fim)
        e_params = list(f_params)

        total_falhas = db.execute(f"SELECT COUNT(*) as cnt FROM falhas WHERE {falhas_filter}", f_params).fetchone()["cnt"]
        falhas_abertas = db.execute(f"SELECT COUNT(*) as cnt FROM falhas WHERE status = 'em_falha' AND {falhas_filter}", f_params).fetchone()["cnt"]
        falhas_resolvidas = db.execute(f"SELECT COUNT(*) as cnt FROM falhas WHERE status = 'resolvida' AND {falhas_filter}", f_params).fetchone()["cnt"]
        falhas_troca_disco = db.execute(f"SELECT COUNT(*) as cnt FROM falhas WHERE (motivo LIKE '%disco%' OR motivo LIKE '%troca%') AND {falhas_filter}", f_params).fetchone()["cnt"]
        total_envios = db.execute(f"SELECT COUNT(*) as cnt FROM emails_enviados WHERE {envios_filter}", e_params).fetchone()["cnt"]
        envios_sucesso = db.execute(f"SELECT COUNT(*) as cnt FROM emails_enviados WHERE status = 'sucesso' AND {envios_filter}", e_params).fetchone()["cnt"]

        taxa_sucesso = (envios_sucesso / total_envios * 100) if total_envios > 0 else 100.0

        return {
            "total_falhas": total_falhas,
            "falhas_abertas": falhas_abertas,
            "falhas_resolvidas": falhas_resolvidas,
            "falhas_troca_disco": falhas_troca_disco,
            "total_envios": total_envios,
            "envios_sucesso": envios_sucesso,
            "taxa_sucesso": round(taxa_sucesso, 1),
        }
