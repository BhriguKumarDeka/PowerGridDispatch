import pytest
from datetime import datetime, timezone
from app.services.topology import TopologyService
from app.services.fault_detector import FaultDetector

class MockDT:
    def __init__(self, id, lat, lon, feeder_id, has_known_topology=True):
        self.id = id
        self.lat = lat
        self.lon = lon
        self.feeder_id = feeder_id
        self.has_known_topology = has_known_topology

class MockPole:
    def __init__(self, id, dt_id, feeder_id, lat, lon, parent_pole_id=None, device_id=None, fw_version="1.4.2", pincode="560078"):
        self.id = id
        self.dt_id = dt_id
        self.feeder_id = feeder_id
        self.lat = lat
        self.lon = lon
        self.parent_pole_id = parent_pole_id
        self.device_id = device_id
        self.fw_version = fw_version
        self.pincode = pincode


@pytest.fixture
def topology_service():
    service = TopologyService()
    
    # Create mock DT and poles for a known topology
    dt = MockDT(id="D-MOCK-01", lat=12.97, lon=77.59, feeder_id="F-MOCK-01", has_known_topology=True)
    poles = [
        MockPole(id="P-01", dt_id="D-MOCK-01", feeder_id="F-MOCK-01", lat=12.971, lon=77.591, parent_pole_id=None, device_id="DEV-01"),
        MockPole(id="P-02", dt_id="D-MOCK-01", feeder_id="F-MOCK-01", lat=12.972, lon=77.592, parent_pole_id="P-01", device_id="DEV-02"),
        MockPole(id="P-03", dt_id="D-MOCK-01", feeder_id="F-MOCK-01", lat=12.973, lon=77.593, parent_pole_id="P-02", device_id="DEV-03")
    ]
    service.build_known_tree(dt, poles)
    
    # Create mock DT and poles for an inferred topology
    dt_inf = MockDT(id="D-MOCK-INF", lat=12.98, lon=77.60, feeder_id="F-MOCK-01", has_known_topology=False)
    poles_inf = [
        MockPole(id="PI-01", dt_id="D-MOCK-INF", feeder_id="F-MOCK-01", lat=12.981, lon=77.601, device_id="DEV-I01"),
        MockPole(id="PI-02", dt_id="D-MOCK-INF", feeder_id="F-MOCK-01", lat=12.982, lon=77.602, device_id="DEV-I02"),
        MockPole(id="PI-03", dt_id="D-MOCK-INF", feeder_id="F-MOCK-01", lat=12.983, lon=77.603, device_id="DEV-I03")
    ]
    service.build_inferred_tree(dt_inf, poles_inf)
    
    return service

def test_span_fault_localization_known(topology_service):
    """Test that a known fault (P1 live, P2/P3 dark) correctly localizes to P1 -> P2 span."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    detector.update_pole_state("P-01", True, now)
    detector.update_pole_state("P-02", False, now)
    detector.update_pole_state("P-03", False, now)
    
    faults = detector.detect_faults()
    assert len(faults) == 1
    
    fault = faults[0]
    assert fault["fault_type"] == "span"
    assert fault["boundary_live_pole"] == "P-01"
    assert fault["boundary_dark_pole"] == "P-02"
    assert "P-02" in fault["affected_poles"]
    assert "P-03" in fault["affected_poles"]
    assert fault["confidence"] == 0.95

def test_dead_sensor_suppression(topology_service):
    """Test that a single dark pole with live children is suppressed as a dead sensor."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    # P1 live, P2 dark (dead sensor), P3 live
    detector.update_pole_state("P-01", True, now)
    detector.update_pole_state("P-02", False, now)
    detector.update_pole_state("P-03", True, now)
    
    faults = detector.detect_faults()
    # Should be suppressed, so no faults are returned
    assert len(faults) == 0

def test_dt_outage_suppression(topology_service):
    """Test that DT-level faults are suppressed during a scheduled outage on the DT."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    # Outage on DT D-MOCK-01
    detector.set_scheduled_outage("dt", "D-MOCK-01", True)
    
    # D-MOCK-01 poles are dark (potential DT fault)
    detector.update_pole_state("P-01", False, now)
    detector.update_pole_state("P-02", False, now)
    detector.update_pole_state("P-03", False, now)
    
    # Keep the other DT live so it doesn't trigger a feeder-level fault
    detector.update_pole_state("PI-01", True, now)
    detector.update_pole_state("PI-02", True, now)
    detector.update_pole_state("PI-03", True, now)
    
    faults = detector.detect_faults()
    # Suppressed, so no faults
    assert len(faults) == 0

def test_feeder_outage_suppression(topology_service):
    """Test that feeder-level faults are suppressed during a scheduled outage on the Feeder."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    # Outage on Feeder F-MOCK-01
    detector.set_scheduled_outage("feeder", "F-MOCK-01", True)
    
    # All poles on both DTs dark (potential Feeder fault)
    detector.update_pole_state("P-01", False, now)
    detector.update_pole_state("P-02", False, now)
    detector.update_pole_state("P-03", False, now)
    detector.update_pole_state("PI-01", False, now)
    detector.update_pole_state("PI-02", False, now)
    detector.update_pole_state("PI-03", False, now)
    
    faults = detector.detect_faults()
    # Suppressed, so no faults
    assert len(faults) == 0


def test_feeder_fault_merging(topology_service):
    """Test that multiple dark DTs on the same feeder are merged into a single feeder fault."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    # Make all poles on both DTs (D-MOCK-01 and D-MOCK-INF) dark
    detector.update_pole_state("P-01", False, now)
    detector.update_pole_state("P-02", False, now)
    detector.update_pole_state("P-03", False, now)
    detector.update_pole_state("PI-01", False, now)
    detector.update_pole_state("PI-02", False, now)
    detector.update_pole_state("PI-03", False, now)
    
    faults = detector.detect_faults()
    # Should merge both DT faults into 1 feeder fault
    assert len(faults) == 1
    assert faults[0]["fault_type"] == "feeder"
    assert faults[0]["feeder_id"] == "F-MOCK-01"

def test_inferred_topology_resolution(topology_service):
    """Test that inferred topology creates valid parent-child relationships and penalizes confidence."""
    detector = FaultDetector(topology_service)
    now = datetime.now(timezone.utc)
    
    # Verify the inferred tree structure was generated
    tree = topology_service.trees["D-MOCK-INF"]
    assert tree["topology_source"] == "inferred"
    assert len(tree["root_poles"]) > 0
    
    # Make root pole live, other poles dark
    root_id = tree["root_poles"][0]
    children = tree["adjacency"].get(root_id, [])
    assert len(children) > 0
    child_id = children[0]
    
    detector.update_pole_state(root_id, True, now)
    detector.update_pole_state(child_id, False, now)
    
    faults = detector.detect_faults()
    assert len(faults) == 1
    assert faults[0]["fault_type"] == "span"
    assert faults[0]["boundary_live_pole"] == root_id
    assert faults[0]["boundary_dark_pole"] == child_id
    assert faults[0]["topology_source"] == "inferred"
    # Should be penalized (0.65 base - 0.1 GPS penalty = 0.55 confidence)
    assert faults[0]["confidence"] == 0.55
