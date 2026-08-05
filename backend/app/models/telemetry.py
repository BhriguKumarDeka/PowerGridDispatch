from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from datetime import datetime, timezone
from app.models.base import Base

class TelemetryEvent(Base):
    __tablename__ = "telemetry_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, index=True, nullable=False)
    pole_id = Column(String, ForeignKey("poles.id"), index=True, nullable=False)
    event = Column(String, nullable=False)
    energized = Column(Boolean, nullable=False)
    ts = Column(DateTime(timezone=True), nullable=False)
    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    seq = Column(Integer, nullable=False)
    battery_mv = Column(Integer, nullable=True)
    rssi = Column(Integer, nullable=True)
    fw = Column(String, nullable=True)
    processed = Column(Boolean, default=False, index=True, nullable=False)
