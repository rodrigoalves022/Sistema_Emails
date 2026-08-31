import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from services.excel_importer import import_excel_data, seed_templates_if_empty
from services.scheduler_service import scheduler_loop
from routers import (
    dashboard,
    clients,
    falhas,
    agendamentos,
    templates,
    emails,
    estatisticas,
    settings,
    auditoria,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Inicializa esquema SQLite
    init_db()
    
    # 2. Popula templates padrão se vazios
    seed_templates_if_empty()

    # 3. Importa base real do Excel se não houver clientes
    from database import get_db
    with get_db() as db:
        cnt = db.execute("SELECT COUNT(*) as cnt FROM empresas").fetchone()["cnt"]
        if cnt == 0:
            print("[INIT] Banco de clientes vazio. Importando base real do cadastro_clientes.xlsx...")
            import_excel_data()

    # 4. Inicia motor de agendamento automático em background
    scheduler_task = asyncio.create_task(scheduler_loop())

    yield

    # Cleanup
    scheduler_task.cancel()


app = FastAPI(
    title="Core TI Expert — Sistema de Gerenciamento de E-mails e Rotinas de Backup",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS liberado para rede local e desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos routers organizados por rotas
app.include_router(dashboard.router)
app.include_router(clients.router)
app.include_router(falhas.router)
app.include_router(agendamentos.router)
app.include_router(templates.router)
app.include_router(emails.router)
app.include_router(estatisticas.router)
app.include_router(settings.router)
app.include_router(auditoria.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Core TI Expert Backup System", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
