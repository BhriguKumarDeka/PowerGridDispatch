from __future__ import annotations
from datetime import datetime
from app.services.topology import TopologyService

class FaultDetector:
    """Detects and localizes faults from pole energization states."""
    
    def __init__(self, topology: TopologyService):
        self.topology = topology
        self.pole_states: dict[str, bool] = {}  # pole_id -> is_energized
        self.last_seen: dict[str, datetime] = {}  # pole_id -> last heartbeat
        self.suppressed_feeders: set[str] = set()  # feeders under scheduled outage
        self.suppressed_dts: set[str] = set()  # DTs under scheduled outage
    
    def update_pole_state(self, pole_id: str, energized: bool, timestamp: datetime):
        """Update the known state of a pole from telemetry."""
        self.pole_states[pole_id] = energized
        self.last_seen[pole_id] = timestamp
    
    def set_scheduled_outage(self, scope: str, target_id: str, active: bool):
        """Mark a feeder or DT as under scheduled outage."""
        if scope == 'feeder':
            if active:
                self.suppressed_feeders.add(target_id)
            else:
                self.suppressed_feeders.discard(target_id)
        elif scope == 'dt':
            if active:
                self.suppressed_dts.add(target_id)
            else:
                self.suppressed_dts.discard(target_id)
    
    def detect_faults(self) -> list[dict]:
        """Analyze current pole states and detect faults."""
        faults = []
        
        for dt_id, tree in self.topology.trees.items():
            if dt_id in self.suppressed_dts:
                continue
            if tree.get('feeder_id') in self.suppressed_feeders:
                continue
            
            dt_faults = self._detect_faults_in_dt(dt_id, tree)
            faults.extend(dt_faults)
        
        feeder_faults = self._detect_feeder_faults()
        faults = self._merge_feeder_faults(faults, feeder_faults)
        
        return faults
    
    def _detect_faults_in_dt(self, dt_id, tree) -> list[dict]:
        """Find fault boundaries within a single DT's tree."""
        faults = []
        poles = tree['poles']
        adjacency = tree['adjacency']
        root_poles = tree['root_poles']
        topology_source = tree['topology_source']
        feeder_id = tree.get('feeder_id', '')
        
        all_dark = True
        any_known = False
        for pid in poles:
            state = self.pole_states.get(pid)
            if state is not None:
                any_known = True
                if state:
                    all_dark = False
                    break
        
        if any_known and all_dark:
            affected = list(poles.keys())
            dt_lat = tree['dt_lat']
            dt_lon = tree['dt_lon']
            first_pole = poles.get(root_poles[0]) if root_poles else None
            faults.append({
                'fault_type': 'dt',
                'dt_id': dt_id,
                'feeder_id': feeder_id,
                'boundary_live_pole': None,
                'boundary_dark_pole': root_poles[0] if root_poles else None,
                'affected_poles': affected,
                'fault_location_lat': dt_lat,
                'fault_location_lon': dt_lon,
                'pincode': first_pole.get('pincode') if first_pole else None,
                'confidence': 0.9 if topology_source == 'known' else 0.7,
                'confidence_reason': f'All {len(affected)} poles under DT {dt_id} are dark. Likely transformer or HT fuse failure.',
                'topology_source': topology_source,
            })
            return faults
        
        visited = set()
        fault_boundaries = []
        
        def walk(pole_id, parent_id=None):
            if pole_id in visited:
                return
            visited.add(pole_id)
            
            state = self._get_effective_state(pole_id, poles, adjacency)
            children = adjacency.get(pole_id, [])
            
            if state is False:
                has_live_child = any(
                    self._get_effective_state(c, poles, adjacency) is True
                    for c in children
                )
                
                if has_live_child:
                    for child_id in children:
                        walk(child_id, pole_id)
                    return
                
                parent_state = None
                if parent_id:
                    parent_state = self._get_effective_state(parent_id, poles, adjacency)
                
                if parent_id is None or parent_state is True:
                    fault_boundaries.append((parent_id, pole_id))
                    return
                else:
                    return
            
            elif state is True:
                for child_id in children:
                    walk(child_id, pole_id)
            else:
                for child_id in children:
                    walk(child_id, pole_id)
        
        for root_id in root_poles:
            walk(root_id, None)
        
        for live_parent_id, dark_child_id in fault_boundaries:
            affected = self._get_downstream_poles(dark_child_id, adjacency)
            
            if live_parent_id and live_parent_id in poles:
                parent_data = poles[live_parent_id]
                child_data = poles[dark_child_id]
                fault_lat = (parent_data['lat'] + child_data['lat']) / 2
                fault_lon = (parent_data['lon'] + child_data['lon']) / 2
            else:
                child_data = poles[dark_child_id]
                fault_lat = child_data['lat']
                fault_lon = child_data['lon']
            
            confidence = 0.95 if topology_source == 'known' else 0.65
            reason_parts = []
            if topology_source == 'known':
                reason_parts.append('Known wiring topology.')
            else:
                reason_parts.append('Topology inferred from GPS coordinates.')
                confidence -= 0.1
            
            if live_parent_id:
                reason_parts.append(f'Live/dark boundary: {live_parent_id} (live) → {dark_child_id} (dark).')
            else:
                reason_parts.append(f'First pole {dark_child_id} after DT is dark.')
            reason_parts.append(f'{len(affected)} poles affected downstream.')
            
            faults.append({
                'fault_type': 'span',
                'dt_id': dt_id,
                'feeder_id': feeder_id,
                'boundary_live_pole': live_parent_id,
                'boundary_dark_pole': dark_child_id,
                'affected_poles': affected,
                'fault_location_lat': fault_lat,
                'fault_location_lon': fault_lon,
                'pincode': poles[dark_child_id].get('pincode'),
                'confidence': round(confidence, 2),
                'confidence_reason': ' '.join(reason_parts),
                'topology_source': topology_source,
            })
        
        return faults
    
    def _get_effective_state(self, pole_id, poles, adjacency):
        state = self.pole_states.get(pole_id)
        if state is not None:
            return state
        
        pole_data = poles.get(pole_id, {})
        if not pole_data.get('device_id'):
            children = adjacency.get(pole_id, [])
            if not children:
                return None
            child_states = [self.pole_states.get(c) for c in children]
            if any(s is True for s in child_states):
                return True
            if all(s is False for s in child_states if s is not None):
                return False
        
        return None
    
    def _get_downstream_poles(self, pole_id, adjacency):
        result = []
        stack = [pole_id]
        while stack:
            current = stack.pop()
            result.append(current)
            stack.extend(adjacency.get(current, []))
        return result
    
    def _detect_feeder_faults(self):
        feeder_dts = {}
        for dt_id, tree in self.topology.trees.items():
            fid = tree.get('feeder_id', '')
            if fid not in feeder_dts:
                feeder_dts[fid] = []
            feeder_dts[fid].append(dt_id)
        
        feeder_faults = []
        for feeder_id, dt_ids in feeder_dts.items():
            if feeder_id in self.suppressed_feeders:
                continue
            
            all_dts_dark = True
            total_affected = []
            for dt_id in dt_ids:
                tree = self.topology.trees[dt_id]
                poles = tree['poles']
                any_live = any(
                    self.pole_states.get(pid) is True
                    for pid in poles
                )
                if any_live:
                    all_dts_dark = False
                    break
                total_affected.extend(poles.keys())
            
            if all_dts_dark and total_affected:
                feeder_faults.append({
                    'fault_type': 'feeder',
                    'feeder_id': feeder_id,
                    'affected_poles': total_affected,
                    'dt_ids': dt_ids,
                })
        
        return feeder_faults
    
    def _merge_feeder_faults(self, dt_faults, feeder_faults):
        feeder_fault_ids = {ff['feeder_id'] for ff in feeder_faults}
        
        filtered = [f for f in dt_faults if f.get('feeder_id') not in feeder_fault_ids]
        
        for ff in feeder_faults:
            first_dt_id = ff['dt_ids'][0]
            tree = self.topology.trees[first_dt_id]
            filtered.append({
                'fault_type': 'feeder',
                'dt_id': first_dt_id,
                'feeder_id': ff['feeder_id'],
                'boundary_live_pole': None,
                'boundary_dark_pole': None,
                'affected_poles': ff['affected_poles'],
                'fault_location_lat': tree['dt_lat'],
                'fault_location_lon': tree['dt_lon'],
                'pincode': None,
                'confidence': 0.85,
                'confidence_reason': f'All {len(ff["dt_ids"])} DTs on feeder {ff["feeder_id"]} are dark. Likely 11kV feeder fault.',
                'topology_source': 'known',
            })
        
        return filtered
