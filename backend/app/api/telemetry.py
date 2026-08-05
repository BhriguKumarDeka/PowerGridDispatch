from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
from dateutil.parser import isoparse

from app.database import get_db, async_session_maker
from app.services.engine import engine_instance

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


class TelemetryPayload(BaseModel):
    device_id: str
    pole_id: Optional[str] = None
    event: str  # heartbeat, power_lost, power_restored, boot
    energized: bool
    ts: str  # ISO 8601 timestamp
    seq: int
    battery_mv: Optional[int] = None
    rssi: Optional[int] = None
    fw: Optional[str] = None


class TelemetryBatch(BaseModel):
    events: list[TelemetryPayload]


async def process_telemetry_event_task(event_data: dict):
    """Background task using a fresh DB session to process a telemetry event."""
    async with async_session_maker() as session:
        await engine_instance.process_telemetry_payload(session, event_data)


async def process_telemetry_batch_task(events: list[dict]):
    """Background task to process a batch of events."""
    async with async_session_maker() as session:
        for event_data in events:
            await engine_instance.process_telemetry_payload(session, event_data)


@router.post("/ingest")
async def ingest_telemetry(
    payload: TelemetryPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Accept a single telemetry event from a pole device."""
    from app.models.telemetry import TelemetryEvent

    try:
        device_ts = isoparse(payload.ts)
    except Exception:
        device_ts = datetime.now(timezone.utc)

    event = TelemetryEvent(
        device_id=payload.device_id,
        pole_id=payload.pole_id or "",
        event=payload.event,
        energized=payload.energized,
        ts=device_ts,
        received_at=datetime.now(timezone.utc),
        seq=payload.seq,
        battery_mv=payload.battery_mv,
        rssi=payload.rssi,
        fw=payload.fw,
    )
    db.add(event)
    await db.commit()

    # Process telemetry and run fault detection
    payload_dict = payload.model_dump()
    background_tasks.add_task(process_telemetry_event_task, payload_dict)

    return {"status": "accepted", "event_id": event.id}


@router.post("/ingest/batch")
async def ingest_batch(
    batch: TelemetryBatch,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Accept a batch of telemetry events."""
    from app.models.telemetry import TelemetryEvent

    events_created = []
    for p in batch.events:
        try:
            device_ts = isoparse(p.ts)
        except Exception:
            device_ts = datetime.now(timezone.utc)

        event = TelemetryEvent(
            device_id=p.device_id,
            pole_id=p.pole_id or "",
            event=p.event,
            energized=p.energized,
            ts=device_ts,
            received_at=datetime.now(timezone.utc),
            seq=p.seq,
            battery_mv=p.battery_mv,
            rssi=p.rssi,
            fw=p.fw,
        )
        db.add(event)
        events_created.append(p.model_dump())

    await db.commit()

    background_tasks.add_task(process_telemetry_batch_task, events_created)

    return {"status": "accepted", "count": len(events_created)}
