from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Substation(Base):
    __tablename__ = "substations"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    feeders = relationship("Feeder", back_populates="substation")

class Feeder(Base):
    __tablename__ = "feeders"
    id = Column(String, primary_key=True)
    substation_id = Column(String, ForeignKey("substations.id"), nullable=False)
    name = Column(String, nullable=False)
    substation = relationship("Substation", back_populates="feeders")
    transformers = relationship("DistributionTransformer", back_populates="feeder")

class DistributionTransformer(Base):
    __tablename__ = "distribution_transformers"
    id = Column(String, primary_key=True)
    feeder_id = Column(String, ForeignKey("feeders.id"), nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    capacity_kva = Column(Integer, nullable=False)
    households_served = Column(Integer, nullable=False)
    has_known_topology = Column(Boolean, default=False)
    feeder = relationship("Feeder", back_populates="transformers")
    poles = relationship("Pole", back_populates="dt")

class Pole(Base):
    __tablename__ = "poles"
    id = Column(String, primary_key=True)
    dt_id = Column(String, ForeignKey("distribution_transformers.id"), nullable=False)
    feeder_id = Column(String, ForeignKey("feeders.id"), nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    seq_on_line = Column(Integer, nullable=True)
    parent_pole_id = Column(String, ForeignKey("poles.id"), nullable=True)
    pole_type = Column(String, nullable=False)
    ward = Column(String, nullable=False)
    pincode = Column(String, nullable=True)
    device_id = Column(String, unique=True, nullable=True)
    fw_version = Column(String, nullable=True)
    
    dt = relationship("DistributionTransformer", back_populates="poles")
    parent_pole = relationship("Pole", remote_side=[id])
