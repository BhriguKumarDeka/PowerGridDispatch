from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, async_session_maker
from app.api.router import api_router
from app.api import ws
from app.config import settings
from app.seeder.generate import seed_database
from app.services.engine import engine_instance

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    async with async_session_maker() as session:
        if settings.SEED_ON_STARTUP:
            await seed_database(session)
        await engine_instance.initialize(session)
    yield
    # Shutdown (nothing needed)

app = FastAPI(
    title="KSPDB Fault Localization System",
    description="Real-time power fault detection and localization",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(api_router)
