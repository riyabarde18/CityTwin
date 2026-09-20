import random
import uuid
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from config import CITY_CENTER_LAT, CITY_CENTER_LON, CATEGORIES
from models import EventModel, PatternModel, EventStatusEventModel
import governance

def generate_seed_data(db: Session) -> int:
    """Clears DB and seeds Hotspot (~16 events), Decoy (6 garbage events), and Noise (~40 events)."""
    # 1. Clear existing database tables (including governance audit trails
    # and risk escalations, which reference events/patterns by id and would
    # otherwise dangle). User accounts/sessions are left untouched so
    # reloading demo data doesn't log anyone out.
    from models import PatternStatusEventModel, EscalationModel
    db.query(EventStatusEventModel).delete()
    db.query(PatternStatusEventModel).delete()
    db.query(EscalationModel).delete()
    db.query(EventModel).delete()
    db.query(PatternModel).delete()
    db.commit()

    events: List[EventModel] = []

    # Recent activity for decoy/noise (unchanged from the original demo
    # dataset — these should read as normal, not overdue).
    base_time = datetime.utcnow() - timedelta(days=5)

    # The hotspot cluster alone is backdated further, past its resolve-by
    # SLA (14d), so it's the one focused, meaningful case risk escalation
    # picks up right after seeding — rather than every scattered noise
    # report also qualifying and flooding the demo with alerts. See
    # risk_escalation.py.
    hotspot_base_time = datetime.utcnow() - timedelta(days=20)

    # ---------------------------------------------------------
    # A. HOTSPOT (~16 events within 50m of city center)
    # Categories: standing_water, footpath_obstruction, pedestrian_on_road, traffic_slowdown, accessibility_barrier
    # 10+ distinct submitter_ids, across 4-5 days, peak time 17:30-19:30
    # ---------------------------------------------------------
    hotspot_categories = [
        ("standing_water", 4, ["water_puddle", "blocked_drain"], "Large pool of standing water accumulating on street edge"),
        ("standing_water", 4, ["overflow_water"], "Water ponding near storm drain inlet"),
        ("standing_water", 5, ["flood_water", "clogged_grate"], "Deep standing water across sidewalk and curb"),
        ("footpath_obstruction", 3, ["street_vendor_cart", "boxes"], "Vendor carts and boxes completely blocking footpath"),
        ("footpath_obstruction", 4, ["parked_scooters", "debris"], "Multiple shared scooters parked across pedestrian walkway"),
        ("footpath_obstruction", 3, ["construction_fence"], "Temporary fence blocking sidewalk passability"),
        ("pedestrian_on_road", 4, ["pedestrians", "traffic_lane"], "Pedestrians forced off flooded sidewalk into active road lane"),
        ("pedestrian_on_road", 5, ["family_walking", "cars_passing"], "Crowd of pedestrians walking in vehicular lane due to blocked path"),
        ("pedestrian_on_road", 4, ["commuters_on_asphalt"], "Commuters walking around standing water in road lane"),
        ("traffic_slowdown", 3, ["queued_vehicles", "brake_lights"], "Traffic slowdown as vehicles brake for pedestrians on road"),
        ("traffic_slowdown", 4, ["bus_stopped", "gridlock"], "Severe traffic delay caused by pedestrians dodging puddle in lane"),
        ("traffic_slowdown", 3, ["slow_moving_cars"], "Vehicles crawling to avoid splashing pedestrians on road"),
        ("accessibility_barrier", 4, ["wheelchair_blocked", "high_step"], "Wheelchair user unable to bypass flooded curb ramp"),
        ("footpath_obstruction", 3, ["illegal_stall"], "Informal commercial stall occupying pedestrian walking path"),
        ("pedestrian_on_road", 4, ["jaywalking_group"], "Group of pedestrians stepping into street to avoid obstruction"),
        ("standing_water", 3, ["roadside_pond"], "Persistent standing water clogging sidewalk corner")
    ]

    hotspot_submitters = [f"citizen_sub_{i:03d}" for i in range(101, 115)]

    for idx, (cat, sev, objs, desc) in enumerate(hotspot_categories):
        # Coordinates within ~30-50m of center (0.0003 deg approx 33m)
        lat_offset = random.uniform(-0.0003, 0.0003)
        lon_offset = random.uniform(-0.0003, 0.0003)
        
        # 4-5 distinct days
        day_offset = idx % 5
        # Mostly between 17:30 and 19:30
        hour = 17 if random.random() < 0.5 else 18
        minute = random.randint(30, 59) if hour == 17 else random.randint(0, 59)
        
        event_dt = hotspot_base_time + timedelta(
            days=day_offset, hours=hour - hotspot_base_time.hour, minutes=minute - hotspot_base_time.minute
        )

        sub_id = hotspot_submitters[idx % len(hotspot_submitters)]

        events.append(EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id=sub_id,
            lat=round(CITY_CENTER_LAT + lat_offset, 6),
            lon=round(CITY_CENTER_LON + lon_offset, 6),
            road_segment_id="SEG_MAIN_ST_400",
            timestamp=event_dt,
            category=cat,
            severity=sev,
            detected_objects=objs,
            description=desc,
            evidence_type="photo" if idx % 2 == 0 else "text",
            image_path=f"/uploads/hotspot_photo_{idx+1}.jpg" if idx % 2 == 0 else None,
            image_hash=f"hash_hotspot_{idx}" if idx % 2 == 0 else None,
            confidence=round(random.uniform(0.88, 0.98), 2),
            is_synthetic=True,
            period="before"
        ))

    # ---------------------------------------------------------
    # A2. CCTV CAMERA EVENTS (3 events, same hotspot area, distinct source
    # type from citizen reports) — demonstrates real cross-source
    # corroboration: a fixed camera and citizen phones independently seeing
    # the same hazard is stronger evidence than more citizen reports alone.
    # See pipeline.compute_pattern_score's cross_source_corroboration term.
    # ---------------------------------------------------------
    camera_events = [
        ("standing_water", 4, ["cam_water_pool"], "Fixed camera CAM_MAIN_ST_04: standing water accumulation across lane"),
        ("pedestrian_on_road", 4, ["cam_pedestrians_lane"], "Fixed camera CAM_MAIN_ST_04: pedestrians detected walking in vehicle lane"),
        ("traffic_slowdown", 3, ["cam_queued_vehicles"], "Fixed camera CAM_MAIN_ST_04: vehicle queue detected, reduced flow speed"),
    ]
    for idx, (cat, sev, objs, desc) in enumerate(camera_events):
        lat_offset = random.uniform(-0.0002, 0.0002)
        lon_offset = random.uniform(-0.0002, 0.0002)
        day_offset = idx % 4
        hour = 18
        event_dt = hotspot_base_time + timedelta(
            days=day_offset, hours=hour - hotspot_base_time.hour, minutes=15 - hotspot_base_time.minute
        )
        events.append(EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id="CAM_MAIN_ST_04",
            lat=round(CITY_CENTER_LAT + lat_offset, 6),
            lon=round(CITY_CENTER_LON + lon_offset, 6),
            road_segment_id="SEG_MAIN_ST_400",
            timestamp=event_dt,
            category=cat,
            severity=sev,
            detected_objects=objs,
            description=desc,
            evidence_type="photo",
            evidence_source_type="cctv_camera",
            image_path=f"/uploads/cctv_snapshot_{idx+1}.jpg",
            image_hash=f"hash_cctv_{idx}",
            confidence=round(random.uniform(0.90, 0.97), 2),
            is_synthetic=True,
            period="before"
        ))

    # ---------------------------------------------------------
    # B. DECOY (6 events, all "garbage", scattered over day, diff location)
    # Must NOT be flagged as pattern because it has only 1 category
    # ---------------------------------------------------------
    decoy_lat_center = CITY_CENTER_LAT + 0.006  # ~660 meters north
    decoy_lon_center = CITY_CENTER_LON + 0.006  # ~660 meters east

    for i in range(6):
        lat_offset = random.uniform(-0.0002, 0.0002)
        lon_offset = random.uniform(-0.0002, 0.0002)
        day_offset = i % 3
        hour = (9 + i * 2) % 24  # scattered hours: 9, 11, 13, 15, 17, 19
        
        event_dt = base_time + timedelta(days=day_offset, hours=hour - base_time.hour, minutes=15)

        events.append(EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id=f"decoy_user_{i+1}",
            lat=round(decoy_lat_center + lat_offset, 6),
            lon=round(decoy_lon_center + lon_offset, 6),
            road_segment_id="SEG_ALLEY_99",
            timestamp=event_dt,
            category="garbage",
            severity=2,
            detected_objects=["overflowing_bin", "litter"],
            description=f"Garbage bin overflowing near alleyway corner report #{i+1}",
            evidence_type="photo",
            image_path=f"/uploads/decoy_garbage_{i+1}.jpg",
            image_hash=f"hash_decoy_{i}",
            confidence=0.90,
            is_synthetic=True,
            period="before"
        ))

    # ---------------------------------------------------------
    # C. NOISE (~40 scattered events across city zone)
    # ---------------------------------------------------------
    noise_submitters = [f"random_user_{i:02d}" for i in range(1, 25)]

    for i in range(40):
        # Scattered across city zone (+- 0.02 deg ~ 2.2 km radius)
        lat_offset = random.uniform(-0.02, 0.02)
        lon_offset = random.uniform(-0.02, 0.02)
        # Avoid putting noise right inside hotspot center
        if abs(lat_offset) < 0.001 and abs(lon_offset) < 0.001:
            lat_offset += 0.005

        cat = random.choice(CATEGORIES)
        day_offset = random.randint(0, 6)
        hour = random.randint(7, 22)
        minute = random.randint(0, 59)

        event_dt = base_time + timedelta(days=day_offset, hours=hour - base_time.hour, minutes=minute)

        events.append(EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id=random.choice(noise_submitters),
            lat=round(CITY_CENTER_LAT + lat_offset, 6),
            lon=round(CITY_CENTER_LON + lon_offset, 6),
            road_segment_id=f"SEG_SCATTERED_{random.randint(100, 999)}",
            timestamp=event_dt,
            category=cat,
            severity=random.randint(1, 4),
            detected_objects=[f"noise_object_{cat}"],
            description=f"Isolated citizen report for {cat} at location #{i+1}",
            evidence_type="text",
            confidence=round(random.uniform(0.75, 0.95), 2),
            is_synthetic=True,
            period="before"
        ))

    # Auto-route every synthetic report exactly as a real submission would be
    # (see governance.initialize_event_governance / main.create_observation),
    # so demo data behaves identically to live citizen reports in the
    # inbox / "My Reports" views — department + zone assigned immediately,
    # with an initial audit-trail entry.
    status_log_entries: List[EventStatusEventModel] = []
    for ev in events:
        governance.initialize_event_governance(ev, ev.timestamp)
        status_log_entries.append(EventStatusEventModel(
            event_id=ev.event_id,
            status=ev.status,
            department=ev.assigned_department,
            zone=ev.assigned_zone,
            note="Auto-routed by CityTwin on submission.",
            actor_label="CityTwin System",
            created_at=ev.timestamp
        ))

    # Add all events + their routing audit trail to DB
    db.add_all(events)
    db.add_all(status_log_entries)
    db.commit()

    return len(events)
