import math
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.network import Substation, Feeder, DistributionTransformer, Pole

def move_point(lat, lon, bearing_deg, distance_m):
    bearing_rad = math.radians(bearing_deg)
    lat_rad = math.radians(lat)
    new_lat = lat + (distance_m / 111320) * math.cos(bearing_rad)
    new_lon = lon + (distance_m / (111320 * math.cos(lat_rad))) * math.sin(bearing_rad)
    return new_lat, new_lon

def random_point_around(lat, lon, min_m, max_m):
    bearing_deg = random.uniform(0, 360)
    distance_m = random.uniform(min_m, max_m)
    return move_point(lat, lon, bearing_deg, distance_m)

async def seed_database(session: AsyncSession):
    result = await session.execute(select(Substation).limit(1))
    if result.scalar_one_or_none():
        print("Data already exists. Skipping seed.")
        return

    print("Seeding 4 substations...")
    substations_data = [
        {"id": "SS-01", "name": "Koramangala", "lat": 12.9352, "lon": 77.6245},
        {"id": "SS-02", "name": "Rajajinagar", "lat": 12.9916, "lon": 77.5521},
        {"id": "SS-03", "name": "Jayanagar", "lat": 12.9250, "lon": 77.5838},
        {"id": "SS-04", "name": "Indiranagar", "lat": 12.9784, "lon": 77.6408}
    ]
    substations = [Substation(**data) for data in substations_data]
    session.add_all(substations)

    print("Seeding 31 feeders...")
    feeders = []
    feeder_idx = 1
    for ss in substations_data:
        num_feeders = 7 if ss["id"] == "SS-04" else 8
        for i in range(num_feeders):
            feeders.append(Feeder(
                id=f"F-{ss['id'].split('-')[1]}-{i+1:02d}",
                substation_id=ss["id"],
                name=f"{ss['name']} Feeder {i+1}"
            ))
            feeder_idx += 1
    session.add_all(feeders)

    print("Seeding ~80 DTs...")
    dts = []
    dt_id_counter = 1
    for feeder in feeders:
        ss_lat, ss_lon = next((s["lat"], s["lon"]) for s in substations_data if s["id"] == feeder.substation_id)
        num_dts = random.randint(2, 3)
        for _ in range(num_dts):
            dt_lat, dt_lon = random_point_around(ss_lat, ss_lon, 500, 2000)
            capacity = random.choice([100, 250, 500])
            households = int(capacity * random.uniform(0.8, 1.2))
            has_known = random.random() < 0.4
            dt = DistributionTransformer(
                id=f"D-{dt_id_counter:04d}",
                feeder_id=feeder.id,
                lat=dt_lat,
                lon=dt_lon,
                capacity_kva=capacity,
                households_served=households,
                has_known_topology=has_known
            )
            dts.append(dt)
            dt_id_counter += 1
    session.add_all(dts)

    print("Seeding poles...")
    poles = []
    pole_id_counter = 1
    ward_counter = 1
    pincodes = ['560001','560002','560004','560008','560009','560010','560011','560017','560018','560019',
                '560020','560025','560029','560030','560034','560038','560041','560047','560050','560068',
                '560070','560078','560085','560095','560100']
    pole_types = ['LT-9m-PCC', 'LT-8m-Steel', 'LT-10m-PCC', 'LT-8m-PCC']

    for dt in dts:
        ward = f"W-{ward_counter:03d}"
        ward_counter += 1
        
        poles_count = random.randint(20, 120)
        trunk_count = int(poles_count * 0.65)
        branch_count = poles_count - trunk_count
        num_branches = random.randint(1, 3)
        branch_sizes = [branch_count // num_branches] * num_branches
        for i in range(branch_count % num_branches):
            branch_sizes[i] += 1
            
        trunk_bearing = random.uniform(0, 360)
        current_lat, current_lon = dt.lat, dt.lon
        
        trunk_poles = []
        for i in range(trunk_count):
            pole_id_str = f"P-{pole_id_counter:06d}"
            pole_id_counter += 1
            
            is_first = (i == 0)
            seq = i + 1 if dt.has_known_topology else None
            parent_id = trunk_poles[-1].id if dt.has_known_topology and not is_first else None
            
            device_id = None
            if random.random() < 0.91:
                ss_short = dt.feeder_id.split('-')[1]
                device_id = f"KSPDB-SD{ss_short}-{dt.id}-{i:04d}"
                
            fw_version = None
            if device_id:
                fw_version = '1.2.3' if random.random() < 0.08 else '1.4.2'
                
            pincode = None if random.random() < 0.03 else random.choice(pincodes)
            
            pole = Pole(
                id=pole_id_str,
                dt_id=dt.id,
                feeder_id=dt.feeder_id,
                lat=current_lat,
                lon=current_lon,
                seq_on_line=seq,
                parent_pole_id=parent_id,
                pole_type=random.choice(pole_types),
                ward=ward,
                pincode=pincode,
                device_id=device_id,
                fw_version=fw_version
            )
            trunk_poles.append(pole)
            current_lat, current_lon = move_point(current_lat, current_lon, trunk_bearing + random.uniform(-5, 5), random.uniform(30, 40))
        
        poles.extend(trunk_poles)
        seq_counter = trunk_count + 1
        
        for branch_idx, branch_size in enumerate(branch_sizes):
            if trunk_count <= 4:
                continue
            junction_idx = random.randint(2, trunk_count - 3)
            junction_pole = trunk_poles[junction_idx]
            
            branch_bearing = trunk_bearing + random.uniform(40, 90) * random.choice([-1, 1])
            branch_lat, branch_lon = junction_pole.lat, junction_pole.lon
            
            prev_pole_id = junction_pole.id
            for i in range(branch_size):
                branch_lat, branch_lon = move_point(branch_lat, branch_lon, branch_bearing + random.uniform(-5, 5), random.uniform(30, 40))
                
                pole_id_str = f"P-{pole_id_counter:06d}"
                pole_id_counter += 1
                
                seq = seq_counter if dt.has_known_topology else None
                seq_counter += 1
                parent_id = prev_pole_id if dt.has_known_topology else None
                
                device_id = None
                if random.random() < 0.91:
                    ss_short = dt.feeder_id.split('-')[1]
                    device_id = f"KSPDB-SD{ss_short}-{dt.id}-{trunk_count + i + branch_idx*100:04d}"
                    
                fw_version = None
                if device_id:
                    fw_version = '1.2.3' if random.random() < 0.08 else '1.4.2'
                    
                pincode = None if random.random() < 0.03 else random.choice(pincodes)
                
                pole = Pole(
                    id=pole_id_str,
                    dt_id=dt.id,
                    feeder_id=dt.feeder_id,
                    lat=branch_lat,
                    lon=branch_lon,
                    seq_on_line=seq,
                    parent_pole_id=parent_id,
                    pole_type=random.choice(pole_types),
                    ward=ward,
                    pincode=pincode,
                    device_id=device_id,
                    fw_version=fw_version
                )
                poles.append(pole)
                prev_pole_id = pole.id

    session.add_all(poles)
    await session.commit()
    print(f"Seed complete! Inserted {len(poles)} poles.")
