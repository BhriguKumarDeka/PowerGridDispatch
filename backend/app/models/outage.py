from sqlalchemy import Column, String, DateTime
from app.models.base import Base

class ScheduledOutage(Base):
    __tablename__ = "scheduled_outages"
    id = Column(String, primary_key=True)
    scope = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String, nullable=False)
