from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class IngestionService:
    """Handles incoming telemetry: dedup, ordering, state tracking."""
    
    def __init__(self):
        self.seen_sequences: dict[str, int] = {}  # device_id -> last seq seen
        self.pole_device_map: dict[str, str] = {}  # device_id -> pole_id
    
    async def initialize(self, session: AsyncSession):
        """Load device->pole mapping from DB."""
        from app.models.network import Pole
        result = await session.execute(
            select(Pole.device_id, Pole.id).where(Pole.device_id.isnot(None))
        )
        for device_id, pole_id in result.all():
            self.pole_device_map[device_id] = pole_id
    
    def is_duplicate(self, device_id: str, seq: int) -> bool:
        """Check if we've already processed this sequence number."""
        if device_id in self.seen_sequences:
            if seq <= self.seen_sequences[device_id]:
                return True  # Already seen or older
        return False
    
    def process_event(self, payload: dict) -> dict | None:
        """Process a single telemetry event."""
        device_id = payload.get('device_id')
        seq = payload.get('seq')
        event = payload.get('event')
        
        if not device_id or seq is None or not event:
            return None
        
        pole_id = payload.get('pole_id') or self.pole_device_map.get(device_id)
        if not pole_id:
            return None
        
        if event == 'boot':
            self.seen_sequences[device_id] = seq
            return {
                'device_id': device_id,
                'pole_id': pole_id,
                'event': event,
                'energized': payload.get('energized', True),
                'ts': payload.get('ts'),
                'seq': seq,
                'battery_mv': payload.get('battery_mv'),
                'rssi': payload.get('rssi'),
                'fw': payload.get('fw'),
            }
        
        if self.is_duplicate(device_id, seq):
            return None
        
        self.seen_sequences[device_id] = max(
            self.seen_sequences.get(device_id, 0), seq
        )
        
        return {
            'device_id': device_id,
            'pole_id': pole_id,
            'event': event,
            'energized': payload.get('energized', event != 'power_lost'),
            'ts': payload.get('ts'),
            'seq': seq,
            'battery_mv': payload.get('battery_mv'),
            'rssi': payload.get('rssi'),
            'fw': payload.get('fw'),
        }
