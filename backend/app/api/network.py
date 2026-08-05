from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.models.network import Substation, Feeder, DistributionTransformer, Pole

router = APIRouter(prefix="/network", tags=["Network"])


def row_to_dict(obj):
    """Convert a SQLAlchemy model instance to a dict, excluding internal attributes."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


@router.get("/stats")
async def get_network_stats(db: AsyncSession = Depends(get_db)):
    substations = await db.scalar(select(func.count(Substation.id)))
    feeders = await db.scalar(select(func.count(Feeder.id)))
    dts = await db.scalar(select(func.count(DistributionTransformer.id)))
    poles = await db.scalar(select(func.count(Pole.id)))
    poles_with_devices = await db.scalar(
        select(func.count(Pole.id)).where(Pole.device_id.isnot(None))
    )
    dts_known_topo = await db.scalar(
        select(func.count(DistributionTransformer.id)).where(
            DistributionTransformer.has_known_topology == True
        )
    )

    devices_online_pct = round((poles_with_devices / poles * 100), 1) if poles else 0
    topology_known_pct = round((dts_known_topo / dts * 100), 1) if dts else 0

    return {
        "substations": substations,
        "feeders": feeders,
        "transformers": dts,
        "poles": poles,
        "poles_with_devices": poles_with_devices,
        "transformers_known_topology": dts_known_topo,
        "devices_online_pct": devices_online_pct,
        "topology_known_pct": topology_known_pct,
    }


@router.get("/substations")
async def get_substations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Substation))
    return [row_to_dict(s) for s in result.scalars().all()]


@router.get("/feeders")
async def get_feeders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Feeder))
    return [row_to_dict(f) for f in result.scalars().all()]


@router.get("/transformers")
async def get_transformers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DistributionTransformer))
    return [row_to_dict(dt) for dt in result.scalars().all()]


@router.get("/poles")
async def get_poles(
    dt_id: Optional[str] = None,
    feeder_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Pole)
    if dt_id:
        query = query.where(Pole.dt_id == dt_id)
    if feeder_id:
        query = query.where(Pole.feeder_id == feeder_id)

    result = await db.execute(query)
    return [row_to_dict(p) for p in result.scalars().all()]
