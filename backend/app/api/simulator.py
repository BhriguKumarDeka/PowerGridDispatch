from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.engine import engine_instance
import random
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/simulator", tags=["Simulator"])


class FaultInjection(BaseModel):
    fault_type: str  # 'span', 'dt', 'feeder'
    target_id: str   # pole_id for span, dt_id for DT, feeder_id for feeder


class RepairRequest(BaseModel):
    ticket_id: int


class NoiseInjection(BaseModel):
    noise_type: str  # 'dead_sensor', 'scheduled_outage'
    target_id: str
    duration_minutes: Optional[int] = 60


def _get_downstream_poles_from_db(all_poles, target_pole_id):
    """Get all poles downstream of target_pole_id using parent_pole_id links.
    Works for DTs with known topology. For unknown topology, falls back to all poles under the DT.
    """
    children_map = {}
    target_dt_id = None
    for p in all_poles:
        if p.id == target_pole_id:
            target_dt_id = p.dt_id
        if p.parent_pole_id:
            children_map.setdefault(p.parent_pole_id, []).append(p)

    downstream = []
    stack = [target_pole_id]
    visited = set()
    while stack:
        pid = stack.pop()
        if pid in visited:
            continue
        visited.add(pid)
        for child in children_map.get(pid, []):
            downstream.append(child)
            stack.append(child.id)

    if not downstream and target_dt_id:
        downstream = [p for p in all_poles if p.dt_id == target_dt_id and p.id != target_pole_id]

    return downstream


@router.post("/inject-fault")
async def inject_fault(
    injection: FaultInjection,
    db: AsyncSession = Depends(get_db),
):
    """Inject a fault into the system by generating realistic telemetry."""
    from app.models.network import Pole
    from app.models.telemetry import TelemetryEvent

    affected_poles = []

    if injection.fault_type == "span":
        result = await db.execute(select(Pole).where(Pole.id == injection.target_id))
        target_pole = result.scalars().first()
        if not target_pole:
            raise HTTPException(status_code=404, detail="Target pole not found")

        all_dt_poles = await db.execute(
            select(Pole).where(Pole.dt_id == target_pole.dt_id)
        )
        all_dt_poles = all_dt_poles.scalars().all()

        downstream = _get_downstream_poles_from_db(all_dt_poles, injection.target_id)
        target_in_list = next((p for p in all_dt_poles if p.id == injection.target_id), None)
        if target_in_list:
            affected_poles = [target_in_list] + downstream
        else:
            affected_poles = downstream

    elif injection.fault_type == "dt":
        result = await db.execute(select(Pole).where(Pole.dt_id == injection.target_id))
        affected_poles = result.scalars().all()
    elif injection.fault_type == "feeder":
        result = await db.execute(
            select(Pole).where(Pole.feeder_id == injection.target_id)
        )
        affected_poles = result.scalars().all()
    else:
        raise HTTPException(status_code=400, detail="Invalid fault type. Use: span, dt, feeder")

    if not affected_poles:
        raise HTTPException(status_code=404, detail="No poles found for the given target")

    events_generated = []
    base_time = datetime.now(timezone.utc)
    created_tickets = []

    for pole in affected_poles:
        if not pole.device_id:
            continue

        is_legacy_fw = pole.fw_version and pole.fw_version.startswith("1.2")

        if is_legacy_fw:
            events_generated.append(
                {"device_id": pole.device_id, "pole_id": pole.id, "event": "silent_death (fw 1.2.x)"}
            )
            # Update state in engine directly for fw 1.2 devices after heartbeat timeout simulation
            engine_instance.fault_detector.update_pole_state(pole.id, False, base_time)
            continue

        if random.random() < 0.30:
            events_generated.append(
                {"device_id": pole.device_id, "pole_id": pole.id, "event": "message_lost (30% failure)"}
            )
            continue

        jitter = random.uniform(0, 5)
        event_time = base_time + timedelta(seconds=jitter)

        payload_dict = {
            "device_id": pole.device_id,
            "pole_id": pole.id,
            "event": "power_lost",
            "energized": False,
            "ts": event_time.isoformat(),
            "seq": random.randint(80000, 99999),
            "battery_mv": random.randint(3100, 3500),
            "rssi": random.randint(-100, -70),
            "fw": pole.fw_version or "1.4.2",
        }

        event = TelemetryEvent(
            device_id=pole.device_id,
            pole_id=pole.id,
            event="power_lost",
            energized=False,
            ts=event_time,
            received_at=datetime.now(timezone.utc),
            seq=payload_dict["seq"],
            battery_mv=payload_dict["battery_mv"],
            rssi=payload_dict["rssi"],
            fw=payload_dict["fw"],
        )
        db.add(event)
        events_generated.append(
            {"device_id": pole.device_id, "pole_id": pole.id, "event": "power_lost"}
        )

        t_ids = await engine_instance.process_telemetry_payload(db, payload_dict)
        created_tickets.extend(t_ids)

    await db.commit()

    return {
        "status": "fault_injected",
        "fault_type": injection.fault_type,
        "target_id": injection.target_id,
        "total_affected_poles": len(affected_poles),
        "events_generated": len(events_generated),
        "created_ticket_ids": created_tickets,
        "events": events_generated,
    }


@router.post("/repair")
async def repair_fault(
    repair: RepairRequest,
    db: AsyncSession = Depends(get_db),
):
    """Repair a fault by generating restoration telemetry (boot + power_restored)."""
    from app.models.ticket import FaultIncident, FaultAffectedPole
    from app.models.network import Pole
    from app.models.telemetry import TelemetryEvent

    result = await db.execute(
        select(FaultIncident).where(FaultIncident.id == repair.ticket_id)
    )
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result2 = await db.execute(
        select(FaultAffectedPole.pole_id).where(
            FaultAffectedPole.fault_incident_id == repair.ticket_id
        )
    )
    affected_pole_ids = [r[0] for r in result2.all()]

    if affected_pole_ids:
        result3 = await db.execute(
            select(Pole).where(Pole.id.in_(affected_pole_ids))
        )
        poles = result3.scalars().all()
    else:
        poles = []

    base_time = datetime.now(timezone.utc)
    # If ticket is in earlier states, advance it to resolved so verification can run
    if ticket.status in ['detected', 'acknowledged', 'crew_assigned']:
        ticket.status = 'resolved'
        ticket.resolved_at = base_time
        await db.commit()

    generated = 0

    for pole in poles:
        # Mark pole state as live in fault detector
        engine_instance.fault_detector.update_pole_state(pole.id, True, base_time)

        if not pole.device_id:
            continue

        jitter = random.uniform(0, 20)
        t_boot = base_time + timedelta(seconds=jitter)
        t_restored = t_boot + timedelta(seconds=random.uniform(1, 5))

        payload_dict = {
            "device_id": pole.device_id,
            "pole_id": pole.id,
            "event": "power_restored",
            "energized": True,
            "ts": t_restored.isoformat(),
            "seq": random.randint(100, 200),
            "fw": pole.fw_version or "1.4.2",
        }

        db.add(
            TelemetryEvent(
                device_id=pole.device_id,
                pole_id=pole.id,
                event="boot",
                energized=True,
                ts=t_boot,
                received_at=datetime.now(timezone.utc),
                seq=1,
                battery_mv=random.randint(3400, 3600),
                rssi=random.randint(-95, -65),
                fw=pole.fw_version or "1.4.2",
            )
        )
        db.add(
            TelemetryEvent(
                device_id=pole.device_id,
                pole_id=pole.id,
                event="power_restored",
                energized=True,
                ts=t_restored,
                received_at=datetime.now(timezone.utc),
                seq=payload_dict["seq"],
                battery_mv=random.randint(3400, 3600),
                rssi=random.randint(-95, -65),
                fw=pole.fw_version or "1.4.2",
            )
        )
        generated += 2

        await engine_instance.process_telemetry_payload(db, payload_dict)

    await db.commit()

    # Now verify restoration of ticket
    verification_result = await engine_instance.ticket_manager.verify_restoration(
        db, repair.ticket_id, engine_instance.fault_detector.pole_states
    )

    return {
        "status": "repair_telemetry_sent",
        "ticket_id": repair.ticket_id,
        "events_generated": generated,
        "verification_result": verification_result,
    }


@router.post("/inject-noise")
async def inject_noise(
    noise: NoiseInjection,
    db: AsyncSession = Depends(get_db),
):
    """Inject noise: dead sensor or scheduled outage."""
    from app.models.outage import ScheduledOutage

    if noise.noise_type == "scheduled_outage":
        now = datetime.now(timezone.utc)
        outage = ScheduledOutage(
            id=f"SO-SIM-{random.randint(1000,9999)}",
            scope="feeder" if noise.target_id.startswith("F") else "dt",
            target_id=noise.target_id,
            start_time=now,
            end_time=now + timedelta(minutes=noise.duration_minutes or 60),
            reason="Simulated scheduled outage",
        )
        db.add(outage)
        await db.commit()
        await engine_instance.noise_filter.load_scheduled_outages(db)
        engine_instance.fault_detector.set_scheduled_outage(
            outage.scope, outage.target_id, True
        )
        return {"status": "scheduled_outage_created", "outage_id": outage.id}

    elif noise.noise_type == "dead_sensor":
        # Simulate dead sensor: pole goes dark, but children remain live
        now = datetime.now(timezone.utc)
        engine_instance.fault_detector.update_pole_state(noise.target_id, False, now)
        detected = engine_instance.fault_detector.detect_faults()
        return {
            "status": "dead_sensor_simulated",
            "target_id": noise.target_id,
            "detected_faults": len(detected),
            "note": "Pole set to dark with live children. FaultDetector suppresses false positive.",
        }

    raise HTTPException(status_code=400, detail="Invalid noise type. Use: dead_sensor, scheduled_outage")


@router.get("/status")
async def simulator_status(db: AsyncSession = Depends(get_db)):
    """Get current simulator state."""
    from app.models.telemetry import TelemetryEvent
    from app.models.ticket import FaultIncident
    from sqlalchemy import func

    telemetry_count = await db.scalar(select(func.count(TelemetryEvent.id)))
    active_tickets = await db.scalar(
        select(func.count(FaultIncident.id)).where(
            FaultIncident.status.notin_(["verified", "closed"])
        )
    )
    return {
        "telemetry_events": telemetry_count or 0,
        "active_tickets": active_tickets or 0,
    }


@router.post("/reset")
async def reset_simulator(db: AsyncSession = Depends(get_db)):
    """Reset: clear all telemetry, tickets, and outages. Network data is preserved."""
    from app.models.telemetry import TelemetryEvent
    from app.models.ticket import FaultIncident, FaultAffectedPole
    from app.models.outage import ScheduledOutage

    await db.execute(delete(FaultAffectedPole))
    await db.execute(delete(FaultIncident))
    await db.execute(delete(TelemetryEvent))
    await db.execute(delete(ScheduledOutage))
    await db.commit()

    await engine_instance.initialize(db)

    return {"status": "reset_complete", "note": "All telemetry, tickets, and outages cleared. Engine re-initialized."}
