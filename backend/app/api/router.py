from fastapi import APIRouter
from app.api import health, network, telemetry, tickets, simulator, outages, ai

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(network.router)
api_router.include_router(telemetry.router)
api_router.include_router(tickets.router)
api_router.include_router(simulator.router)
api_router.include_router(outages.router)
api_router.include_router(ai.router)
