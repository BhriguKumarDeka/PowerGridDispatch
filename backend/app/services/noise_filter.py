from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class NoiseFilter:
    """Filters out non-fault events: scheduled outages, dead sensors, transients."""
    
    def __init__(self):
        self.scheduled_outages: list[dict] = []  # loaded from DB/API
    
    async def load_scheduled_outages(self, session: AsyncSession):
        """Load active and upcoming scheduled outages."""
        from app.models.outage import ScheduledOutage
        result = await session.execute(select(ScheduledOutage))
        self.scheduled_outages = [{
            'id': o.id,
            'scope': o.scope,
            'target_id': o.target_id,
            'start_time': o.start_time,
            'end_time': o.end_time,
            'reason': o.reason,
        } for o in result.scalars().all()]
    
    def is_under_scheduled_outage(self, scope: str, target_id: str, at_time: datetime) -> bool:
        """Check if a feeder/DT is under scheduled outage at a given time."""
        for outage in self.scheduled_outages:
            if outage['scope'] == scope and outage['target_id'] == target_id:
                buffered_start = outage['start_time'] - timedelta(minutes=10)
                buffered_end = outage['end_time'] + timedelta(minutes=40)
                if buffered_start <= at_time <= buffered_end:
                    return True
        return False
    
    def is_dead_sensor(self, pole_id: str, pole_states: dict, children: list[str]) -> bool:
        """Detect dead sensor: pole dark but children are live."""
        pole_state = pole_states.get(pole_id)
        if pole_state is not False:
            return False
        return any(pole_states.get(c) is True for c in children)
    
    def should_debounce(self, pole_id: str, event_time: datetime, recent_events: list) -> bool:
        """Debounce transient flickers (power lost and restored within 30s)."""
        for event in recent_events:
            if event['pole_id'] == pole_id and event['event'] == 'power_restored':
                if (event_time - event['ts']).total_seconds() < 30:
                    return True
        return False
