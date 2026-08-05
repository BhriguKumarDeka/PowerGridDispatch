from __future__ import annotations
from datetime import datetime, timezone
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.topology import TopologyService
from app.services.ingestion import IngestionService
from app.services.fault_detector import FaultDetector
from app.services.ticket_manager import TicketManager
from app.services.noise_filter import NoiseFilter
from app.services.websocket_manager import ws_manager
from app.models.ticket import FaultIncident

logger = logging.getLogger(__name__)

class FaultEngine:
    """Singleton engine coordinating topology, ingestion, detection, and tickets."""
    
    def __init__(self):
        self.topology = TopologyService()
        self.ingestion = IngestionService()
        self.fault_detector = FaultDetector(self.topology)
        self.ticket_manager = TicketManager()
        self.noise_filter = NoiseFilter()
        self.is_initialized = False

    async def initialize(self, session: AsyncSession):
        """Initialize engine topology and ingestion maps from database."""
        logger.info("Initializing FaultEngine...")
        await self.topology.build_all(session)
        await self.ingestion.initialize(session)
        await self.noise_filter.load_scheduled_outages(session)
        
        # Populate initial pole states (all energized = True)
        from app.models.network import Pole
        res = await session.execute(select(Pole.id))
        all_pole_ids = res.scalars().all()
        now = datetime.now(timezone.utc)
        for pid in all_pole_ids:
            self.fault_detector.update_pole_state(pid, True, now)

        self.is_initialized = True
        logger.info(f"FaultEngine initialized with {len(self.topology.trees)} DT trees.")

    async def process_telemetry_payload(self, session: AsyncSession, payload: dict) -> list[int]:
        """Process a single telemetry payload dictionary, run fault detection, and create/update tickets.
        Returns created ticket IDs."""
        if not self.is_initialized:
            await self.initialize(session)
            
        processed = self.ingestion.process_event(payload)
        if not processed:
            return []

        pole_id = processed['pole_id']
        energized = processed['energized']
        ts = processed['ts']
        if isinstance(ts, str):
            from dateutil.parser import isoparse
            try:
                ts = isoparse(ts)
            except:
                ts = datetime.now(timezone.utc)
        elif not ts:
            ts = datetime.now(timezone.utc)

        # Update state
        self.fault_detector.update_pole_state(pole_id, energized, ts)
        
        # Run detection
        detected_faults = self.fault_detector.detect_faults()
        
        created_ticket_ids = []
        for fault in detected_faults:
            # Check if active ticket already exists for this fault
            query = select(FaultIncident).where(
                FaultIncident.status.notin_(['verified', 'closed'])
            )
            if fault['fault_type'] == 'span':
                query = query.where(
                    FaultIncident.fault_span_from_pole_id == fault.get('boundary_live_pole'),
                    FaultIncident.fault_span_to_pole_id == fault.get('boundary_dark_pole'),
                )
            elif fault['fault_type'] == 'dt':
                query = query.where(
                    FaultIncident.fault_type == 'dt',
                    FaultIncident.dt_id == fault['dt_id']
                )
            elif fault['fault_type'] == 'feeder':
                query = query.where(
                    FaultIncident.fault_type == 'feeder',
                    FaultIncident.feeder_id == fault['feeder_id']
                )

            existing = await session.execute(query)
            if existing.scalar_one_or_none():
                # Already ticketed and active
                continue

            # Create new ticket
            ticket_id = await self.ticket_manager.create_ticket(session, fault)
            created_ticket_ids.append(ticket_id)
            logger.info(f"Created ticket #{ticket_id} for {fault['fault_type']} fault in DT {fault['dt_id']}")

            # Broadcast live ticket creation via WebSocket
            await ws_manager.broadcast({
                "type": "ticket_created",
                "ticket_id": ticket_id,
                "fault_type": fault['fault_type'],
                "dt_id": fault['dt_id'],
                "feeder_id": fault['feeder_id'],
                "title": fault.get('title', f"Fault #{ticket_id}")
            })

        # Auto verify any resolved tickets if telemetry shows power restored
        verified = await self.ticket_manager.auto_verify_tickets(session, self.fault_detector.pole_states)
        for v_id in verified:
            await ws_manager.broadcast({
                "type": "ticket_verified",
                "ticket_id": v_id
            })

        return created_ticket_ids

# Global engine instance
engine_instance = FaultEngine()
