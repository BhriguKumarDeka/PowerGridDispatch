from __future__ import annotations
import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.network import DistributionTransformer, Pole

class TopologyService:
    """Builds and caches the pole tree topology for all DTs."""
    
    def __init__(self):
        self.trees: dict[str, dict] = {}  # dt_id -> tree structure
    
    async def build_all(self, session: AsyncSession):
        """Load all poles from DB and build trees for every DT."""
        dt_result = await session.execute(select(DistributionTransformer))
        dts = dt_result.scalars().all()
        
        pole_result = await session.execute(select(Pole))
        all_poles = pole_result.scalars().all()
        
        # Group poles by DT
        dt_poles = {dt.id: [] for dt in dts}
        for pole in all_poles:
            if pole.dt_id in dt_poles:
                dt_poles[pole.dt_id].append(pole)
                
        for dt in dts:
            poles = dt_poles[dt.id]
            if dt.has_known_topology:
                self.build_known_tree(dt, poles)
            else:
                self.build_inferred_tree(dt, poles)
    
    def build_known_tree(self, dt, poles):
        """Build tree from parent_pole_id relationships."""
        adjacency = {p.id: [] for p in poles}
        parent_map = {}
        root_poles = []
        pole_map = {p.id: p for p in poles}
        
        for p in poles:
            parent_map[p.id] = p.parent_pole_id
            if p.parent_pole_id is None:
                root_poles.append(p.id)
            elif p.parent_pole_id in adjacency:
                adjacency[p.parent_pole_id].append(p.id)
                
        self.trees[dt.id] = {
            'dt_id': dt.id,
            'dt_lat': dt.lat,
            'dt_lon': dt.lon,
            'topology_source': 'known',
            'feeder_id': dt.feeder_id,
            'poles': {p.id: {'lat': p.lat, 'lon': p.lon, 'pincode': p.pincode, 'device_id': p.device_id, 'fw_version': p.fw_version} for p in poles},
            'root_poles': root_poles,
            'adjacency': adjacency,
            'parent_map': parent_map,
        }
    
    def build_inferred_tree(self, dt, poles):
        """Infer tree topology from GPS coordinates."""
        if not poles:
            self.trees[dt.id] = {
                'dt_id': dt.id,
                'dt_lat': dt.lat,
                'dt_lon': dt.lon,
                'topology_source': 'inferred',
                'feeder_id': dt.feeder_id,
                'poles': {},
                'root_poles': [],
                'adjacency': {},
                'parent_map': {},
            }
            return
        
        # Sort poles by distance to DT
        dt_loc = (dt.lat, dt.lon)
        
        def distance(p1, p2):
            """Approximate distance in meters between two lat/lon points."""
            dlat = (p1[0] - p2[0]) * 111320
            dlon = (p1[1] - p2[1]) * 111320 * math.cos(math.radians(p1[0]))
            return math.sqrt(dlat**2 + dlon**2)
        
        def bearing(p1, p2):
            """Bearing from p1 to p2 in degrees."""
            dlat = p2[0] - p1[0]
            dlon = p2[1] - p1[1]
            return math.degrees(math.atan2(dlon, dlat)) % 360
        
        def angle_diff(a1, a2):
            """Minimum angle between two bearings."""
            d = abs(a1 - a2) % 360
            return min(d, 360 - d)
        
        # 1. Find nearest pole to DT - this is the first root
        poles_by_dist = sorted(poles, key=lambda p: distance(dt_loc, (p.lat, p.lon)))
        
        visited = set()
        adjacency = {p.id: [] for p in poles}
        parent_map = {}
        root_poles = []
        pole_map = {p.id: p for p in poles}
        
        # 2. Walk from DT to build main trunk
        def walk_line(start_pole, prev_bearing=None):
            current = start_pole
            visited.add(current.id)
            
            while True:
                current_loc = (current.lat, current.lon)
                # Find nearest unvisited pole
                candidates = [
                    p for p in poles 
                    if p.id not in visited
                    and distance(current_loc, (p.lat, p.lon)) < 150  # max 150m between poles
                ]
                
                if not candidates:
                    break
                
                # Sort by distance
                candidates.sort(key=lambda p: distance(current_loc, (p.lat, p.lon)))
                
                # Apply angle constraint if we have a previous bearing
                chosen = None
                if prev_bearing is not None:
                    for c in candidates:
                        b = bearing(current_loc, (c.lat, c.lon))
                        if angle_diff(prev_bearing, b) < 120:
                            chosen = c
                            prev_bearing = b
                            break
                
                if chosen is None:
                    chosen = candidates[0]
                    prev_bearing = bearing(current_loc, (chosen.lat, chosen.lon))
                
                # Add to tree
                adjacency[current.id].append(chosen.id)
                parent_map[chosen.id] = current.id
                visited.add(chosen.id)
                current = chosen
        
        # Start with nearest pole to DT
        first_pole = poles_by_dist[0]
        root_poles.append(first_pole.id)
        parent_map[first_pole.id] = None
        initial_bearing = bearing(dt_loc, (first_pole.lat, first_pole.lon))
        walk_line(first_pole, initial_bearing)
        
        # 3. Handle remaining unvisited poles as branches
        max_iterations = len(poles)  # safety
        iteration = 0
        while len(visited) < len(poles) and iteration < max_iterations:
            iteration += 1
            unvisited = [p for p in poles if p.id not in visited]
            if not unvisited:
                break
            
            # Find the unvisited pole closest to any visited pole
            best_pair = None
            best_dist = float('inf')
            for uv in unvisited:
                for v_id in visited:
                    v = pole_map[v_id]
                    d = distance((uv.lat, uv.lon), (v.lat, v.lon))
                    if d < best_dist:
                        best_dist = d
                        best_pair = (v, uv)
            
            if best_pair and best_dist < 200:  # reasonable branch distance
                parent_visited, child_unvisited = best_pair
                adjacency[parent_visited.id].append(child_unvisited.id)
                parent_map[child_unvisited.id] = parent_visited.id
                b = bearing((parent_visited.lat, parent_visited.lon), (child_unvisited.lat, child_unvisited.lon))
                walk_line(child_unvisited, b)
            else:
                # Orphaned pole cluster - treat as separate root
                nearest_unvisited = min(unvisited, key=lambda p: distance(dt_loc, (p.lat, p.lon)))
                root_poles.append(nearest_unvisited.id)
                parent_map[nearest_unvisited.id] = None
                walk_line(nearest_unvisited)
        
        self.trees[dt.id] = {
            'dt_id': dt.id,
            'dt_lat': dt.lat,
            'dt_lon': dt.lon,
            'topology_source': 'inferred',
            'feeder_id': dt.feeder_id,
            'poles': {p.id: {'lat': p.lat, 'lon': p.lon, 'pincode': p.pincode, 'device_id': p.device_id, 'fw_version': p.fw_version} for p in poles},
            'root_poles': root_poles,
            'adjacency': adjacency,
            'parent_map': parent_map,
        }
    
    def get_subtree(self, dt_id: str, pole_id: str) -> list[str]:
        """Get all poles downstream of a given pole (inclusive)."""
        tree = self.trees.get(dt_id)
        if not tree:
            return []
        
        adjacency = tree['adjacency']
        result = []
        stack = [pole_id]
        while stack:
            current = stack.pop()
            result.append(current)
            stack.extend(adjacency.get(current, []))
        return result
    
    def get_parent(self, dt_id: str, pole_id: str) -> str | None:
        """Get the parent of a pole."""
        tree = self.trees.get(dt_id)
        if not tree:
            return None
        return tree['parent_map'].get(pole_id)
    
    def get_children(self, dt_id: str, pole_id: str) -> list[str]:
        """Get direct children of a pole."""
        tree = self.trees.get(dt_id)
        if not tree:
            return []
        return tree['adjacency'].get(pole_id, [])
    
    def get_path_to_root(self, dt_id: str, pole_id: str) -> list[str]:
        """Get the path from a pole back to the DT (list of pole_ids)."""
        tree = self.trees.get(dt_id)
        if not tree:
            return []
        
        path = []
        current = pole_id
        parent_map = tree['parent_map']
        while current is not None:
            path.append(current)
            current = parent_map.get(current)
        return path
    
    def get_dt_for_pole(self, pole_id: str) -> str | None:
        """Look up which DT a pole belongs to."""
        for dt_id, tree in self.trees.items():
            if pole_id in tree['poles']:
                return dt_id
        return None
