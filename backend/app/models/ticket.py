from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.base import Base

class FaultIncident(Base):
    __tablename__ = "fault_incidents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    fault_type = Column(String, nullable=False)
    status = Column(String, default="detected", nullable=False)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    crew_assigned_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    fault_span_from_pole_id = Column(String, ForeignKey("poles.id"), nullable=True)
    fault_span_to_pole_id = Column(String, ForeignKey("poles.id"), nullable=True)
    fault_location_lat = Column(Float, nullable=False)
    fault_location_lon = Column(Float, nullable=False)
    pincode = Column(String, nullable=True)
    affected_pole_count = Column(Integer, default=0, nullable=False)
    confidence = Column(Float, default=0.0, nullable=False)
    confidence_reason = Column(String, nullable=True)
    dt_id = Column(String, ForeignKey("distribution_transformers.id"), nullable=False)
    feeder_id = Column(String, ForeignKey("feeders.id"), nullable=False)
    topology_source = Column(String, nullable=False)
    ai_summary = Column(Text, nullable=True)
    title = Column(String, nullable=False)
    
    affected_poles = relationship("FaultAffectedPole", back_populates="incident")

class FaultAffectedPole(Base):
    __tablename__ = "fault_affected_poles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    fault_incident_id = Column(Integer, ForeignKey("fault_incidents.id"), nullable=False)
    pole_id = Column(String, ForeignKey("poles.id"), nullable=False)
    
    incident = relationship("FaultIncident", back_populates="affected_poles")
