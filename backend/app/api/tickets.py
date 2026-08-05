from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db

router = APIRouter(prefix="/tickets", tags=["Tickets"])

class StatusUpdate(BaseModel):
    status: str

@router.get("/")
async def list_tickets(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all fault incident tickets, optionally filtered by status."""
    from app.models.ticket import FaultIncident
    
    query = select(FaultIncident).order_by(FaultIncident.detected_at.desc())
    if status:
        query = query.where(FaultIncident.status == status)
    
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    return [{
        'id': t.id,
        'fault_type': t.fault_type,
        'status': t.status,
        'title': t.title,
        'detected_at': t.detected_at.isoformat() if t.detected_at else None,
        'acknowledged_at': t.acknowledged_at.isoformat() if t.acknowledged_at else None,
        'crew_assigned_at': t.crew_assigned_at.isoformat() if t.crew_assigned_at else None,
        'resolved_at': t.resolved_at.isoformat() if t.resolved_at else None,
        'verified_at': t.verified_at.isoformat() if t.verified_at else None,
        'closed_at': t.closed_at.isoformat() if t.closed_at else None,
        'fault_location_lat': t.fault_location_lat,
        'fault_location_lon': t.fault_location_lon,
        'pincode': t.pincode,
        'affected_pole_count': t.affected_pole_count,
        'confidence': t.confidence,
        'confidence_reason': t.confidence_reason,
        'dt_id': t.dt_id,
        'feeder_id': t.feeder_id,
        'topology_source': t.topology_source,
        'fault_span_from_pole_id': t.fault_span_from_pole_id,
        'fault_span_to_pole_id': t.fault_span_to_pole_id,
        'ai_summary': t.ai_summary,
    } for t in tickets]

@router.get("/{ticket_id}")
async def get_ticket(ticket_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single ticket with its affected poles."""
    from app.models.ticket import FaultIncident, FaultAffectedPole
    
    result = await db.execute(select(FaultIncident).where(FaultIncident.id == ticket_id))
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    affected_poles_res = await db.execute(
        select(FaultAffectedPole).where(FaultAffectedPole.fault_incident_id == ticket_id)
    )
    affected_poles = affected_poles_res.scalars().all()
    
    return {
        'id': ticket.id,
        'fault_type': ticket.fault_type,
        'status': ticket.status,
        'title': ticket.title,
        'detected_at': ticket.detected_at.isoformat() if ticket.detected_at else None,
        'acknowledged_at': ticket.acknowledged_at.isoformat() if ticket.acknowledged_at else None,
        'crew_assigned_at': ticket.crew_assigned_at.isoformat() if ticket.crew_assigned_at else None,
        'resolved_at': ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        'verified_at': ticket.verified_at.isoformat() if ticket.verified_at else None,
        'closed_at': ticket.closed_at.isoformat() if ticket.closed_at else None,
        'fault_location_lat': ticket.fault_location_lat,
        'fault_location_lon': ticket.fault_location_lon,
        'pincode': ticket.pincode,
        'affected_pole_count': ticket.affected_pole_count,
        'confidence': ticket.confidence,
        'confidence_reason': ticket.confidence_reason,
        'dt_id': ticket.dt_id,
        'feeder_id': ticket.feeder_id,
        'topology_source': ticket.topology_source,
        'fault_span_from_pole_id': ticket.fault_span_from_pole_id,
        'fault_span_to_pole_id': ticket.fault_span_to_pole_id,
        'ai_summary': ticket.ai_summary,
        'affected_poles': [p.pole_id for p in affected_poles]
    }

@router.patch("/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    body: StatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update ticket status with validation."""
    from app.models.ticket import FaultIncident
    from app.services.engine import engine_instance
    
    res = await engine_instance.ticket_manager.transition_ticket(db, ticket_id, body.status)
    if 'error' in res:
        raise HTTPException(status_code=400, detail=res['error'])
    return res

@router.get("/active/count")
async def active_ticket_count(db: AsyncSession = Depends(get_db)):
    """Get count of active (non-closed) tickets."""
    from app.models.ticket import FaultIncident
    
    result = await db.execute(
        select(func.count(FaultIncident.id)).where(FaultIncident.status != 'closed')
    )
    count = result.scalar()
    return {"count": count}
