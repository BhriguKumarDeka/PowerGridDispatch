from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class TicketManager:
    """Creates and manages fault incident tickets."""
    
    VALID_TRANSITIONS = {
        'detected': ['acknowledged'],
        'acknowledged': ['crew_assigned'],
        'crew_assigned': ['resolved'],
        'resolved': ['verified', 'crew_assigned'],
        'verified': ['closed'],
        'closed': [],
    }
    
    async def create_ticket(self, session: AsyncSession, fault: dict) -> int:
        """Create a new fault incident ticket from a detected fault."""
        from app.models.ticket import FaultIncident, FaultAffectedPole
        
        if fault['fault_type'] == 'span':
            title = f"Span fault: {fault.get('boundary_live_pole', '?')} → {fault.get('boundary_dark_pole', '?')}"
        elif fault['fault_type'] == 'dt':
            title = f"Transformer fault: {fault['dt_id']}"
        else:
            title = f"Feeder fault: {fault['feeder_id']}"
        
        incident = FaultIncident(
            fault_type=fault['fault_type'],
            status='detected',
            detected_at=datetime.now(timezone.utc),
            fault_span_from_pole_id=fault.get('boundary_live_pole'),
            fault_span_to_pole_id=fault.get('boundary_dark_pole'),
            fault_location_lat=fault['fault_location_lat'],
            fault_location_lon=fault['fault_location_lon'],
            pincode=fault.get('pincode'),
            affected_pole_count=len(fault.get('affected_poles', [])),
            confidence=fault.get('confidence', 0.0),
            confidence_reason=fault.get('confidence_reason', ''),
            dt_id=fault['dt_id'],
            feeder_id=fault['feeder_id'],
            topology_source=fault.get('topology_source', 'unknown'),
            title=title,
        )
        session.add(incident)
        await session.flush()
        
        for pole_id in fault.get('affected_poles', []):
            session.add(FaultAffectedPole(
                fault_incident_id=incident.id,
                pole_id=pole_id,
            ))
        
        await session.commit()
        return incident.id
    
    async def transition_ticket(self, session: AsyncSession, ticket_id: int, new_status: str) -> dict:
        """Transition a ticket to a new status with validation."""
        from app.models.ticket import FaultIncident
        
        result = await session.execute(
            select(FaultIncident).where(FaultIncident.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return {'error': 'Ticket not found'}
        
        if new_status not in self.VALID_TRANSITIONS.get(ticket.status, []):
            return {'error': f'Cannot transition from {ticket.status} to {new_status}'}
        
        now = datetime.now(timezone.utc)
        ticket.status = new_status
        
        timestamp_map = {
            'acknowledged': 'acknowledged_at',
            'crew_assigned': 'crew_assigned_at',
            'resolved': 'resolved_at',
            'verified': 'verified_at',
            'closed': 'closed_at',
        }
        if new_status in timestamp_map:
            setattr(ticket, timestamp_map[new_status], now)
        
        await session.commit()
        return {'status': 'ok', 'ticket_id': ticket_id, 'new_status': new_status}
    
    async def verify_restoration(self, session: AsyncSession, ticket_id: int, pole_states: dict) -> dict:
        """Check if affected poles are back online."""
        from app.models.ticket import FaultIncident, FaultAffectedPole
        
        result = await session.execute(
            select(FaultIncident).where(FaultIncident.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            return {'error': 'Ticket not found'}
        
        if ticket.status != 'resolved':
            return {'error': 'Ticket is not in resolved status'}
        
        result = await session.execute(
            select(FaultAffectedPole.pole_id).where(
                FaultAffectedPole.fault_incident_id == ticket_id
            )
        )
        affected_pole_ids = [r[0] for r in result.all()]
        
        all_restored = True
        still_dark = []
        for pid in affected_pole_ids:
            state = pole_states.get(pid)
            if state is not True:
                all_restored = False
                still_dark.append(pid)
        
        if all_restored:
            return await self.transition_ticket(session, ticket_id, 'verified')
        else:
            ticket.status = 'crew_assigned'
            ticket.resolved_at = None
            await session.commit()
            return {
                'status': 'rejected',
                'reason': f'{len(still_dark)} poles still dark: {still_dark[:5]}...',
                'ticket_id': ticket_id,
            }
    
    async def auto_verify_tickets(self, session: AsyncSession, pole_states: dict) -> list[int]:
        """Check all resolved tickets and auto-verify if restoration confirmed."""
        from app.models.ticket import FaultIncident
        
        result = await session.execute(
            select(FaultIncident).where(
                FaultIncident.status.in_(['resolved', 'crew_assigned', 'acknowledged', 'detected'])
            )
        )
        tickets = result.scalars().all()
        
        verified = []
        for ticket in tickets:
            if ticket.status == 'resolved':
                verify_result = await self.verify_restoration(session, ticket.id, pole_states)
                if verify_result.get('new_status') == 'verified':
                    verified.append(ticket.id)
        
        return verified
