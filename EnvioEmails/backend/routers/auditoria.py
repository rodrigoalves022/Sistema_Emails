from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/auditoria", tags=["Auditoria do Sistema"])


@router.get("")
def list_auditoria(entidade: str | None = None, limit: int = 100):
    with get_db() as db:
        query = "SELECT * FROM auditoria WHERE 1=1"
        params = []

        if entidade and entidade != "todas":
            query += " AND entidade = ?"
            params.append(entidade.upper())

        query += " ORDER BY data_hora DESC LIMIT ?"
        params.append(limit)

        rows = db.execute(query, params).fetchall()
        return [dict(r) for r in rows]
