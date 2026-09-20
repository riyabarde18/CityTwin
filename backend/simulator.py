import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from models import EventModel, PatternModel
from pipeline import haversine_distance_meters
import governance

def simulate_intervention(db: Session, pattern_id: str) -> Dict[str, Any]:
    """Generates 'after' period events with reduced problem category counts and computes before/after comparison."""
    pattern = db.query(PatternModel).filter(PatternModel.pattern_id == pattern_id).first()
    if not pattern:
        raise ValueError(f"Pattern with id {pattern_id} not found")

    # Fetch 'before' events around pattern center
    all_before_events = db.query(EventModel).filter(EventModel.period == "before").all()
    
    before_cluster_events = [
        e for e in all_before_events
        if haversine_distance_meters(pattern.center_lat, pattern.center_lon, e.lat, e.lon) <= max(pattern.radius_m, 60.0)
    ]

    if not before_cluster_events:
        # Fallback if query returns none
        before_cluster_events = all_before_events[:10]

    # Delete existing 'after' events for this pattern location to allow clean re-simulation
    all_after_events = db.query(EventModel).filter(EventModel.period == "after").all()
    for e in all_after_events:
        if haversine_distance_meters(pattern.center_lat, pattern.center_lon, e.lat, e.lon) <= max(pattern.radius_m, 60.0):
            db.delete(e)
    db.commit()

    # Category counts in before period
    before_cat_counts: Dict[str, int] = {}
    for e in before_cluster_events:
        before_cat_counts[e.category] = before_cat_counts.get(e.category, 0) + 1

    # Generate reduced 'after' events (simulate post-drainage/post-enforcement period)
    # Problem categories get ~75-85% reduction
    generated_after: List[EventModel] = []
    base_after_time = datetime.utcnow() + timedelta(days=14)

    for cat, count in before_cat_counts.items():
        if cat in pattern.top_categories:
            # High reduction for problem categories (retain ~15-25% of reports)
            after_count = max(1, int(count * random.uniform(0.15, 0.25)))
        else:
            after_count = max(0, count - 1)

        for idx in range(after_count):
            lat_offset = random.uniform(-0.0003, 0.0003)
            lon_offset = random.uniform(-0.0003, 0.0003)
            day_offset = random.randint(0, 5)
            hour = random.randint(9, 19)

            ev = EventModel(
                event_id=str(uuid.uuid4()),
                submitter_id=f"after_reporter_{idx+1}",
                lat=round(pattern.center_lat + lat_offset, 6),
                lon=round(pattern.center_lon + lon_offset, 6),
                road_segment_id="SEG_MAIN_ST_400",
                timestamp=base_after_time + timedelta(days=day_offset, hours=hour),
                category=cat,
                severity=max(1, random.randint(1, 2)),
                detected_objects=[f"resolved_{cat}"],
                description=f"Post-intervention follow-up report for {cat}",
                evidence_type="photo",
                confidence=0.91,
                is_synthetic=True,
                period="after"
            )
            governance.initialize_event_governance(ev, ev.timestamp)
            generated_after.append(ev)

    db.add_all(generated_after)
    db.commit()

    # Compute comparison metrics
    after_cat_counts: Dict[str, int] = {}
    for e in generated_after:
        after_cat_counts[e.category] = after_cat_counts.get(e.category, 0) + 1

    category_comparison = []
    all_cats = set(before_cat_counts.keys()).union(set(after_cat_counts.keys()))
    
    for cat in all_cats:
        b_cnt = before_cat_counts.get(cat, 0)
        a_cnt = after_cat_counts.get(cat, 0)
        red_pct = round(((b_cnt - a_cnt) / max(1, b_cnt)) * 100.0, 1)
        category_comparison.append({
            "category": cat,
            "before_count": b_cnt,
            "after_count": a_cnt,
            "reduction_pct": red_pct
        })

    before_total = len(before_cluster_events)
    after_total = len(generated_after)
    overall_reduction = round(((before_total - after_total) / max(1, before_total)) * 100.0, 1)

    # Weekly timeline comparison (Week 1-2 Pre-intervention vs Week 3-4 Post-intervention)
    weekly_timeline = [
        {"week_label": "Week -2 (Baseline)", "before_count": int(before_total * 0.45), "after_count": 0},
        {"week_label": "Week -1 (Peak Problem)", "before_count": int(before_total * 0.55), "after_count": 0},
        {"week_label": "Week +1 (Post Intervention)", "before_count": 0, "after_count": int(after_total * 0.6)},
        {"week_label": "Week +2 (Sustained Fix)", "before_count": 0, "after_count": int(after_total * 0.4)}
    ]

    return {
        "pattern_id": pattern_id,
        "before_total_events": before_total,
        "after_total_events": after_total,
        "overall_reduction_pct": overall_reduction,
        "category_comparison": category_comparison,
        "weekly_timeline": weekly_timeline,
        "generated_after_events": generated_after,
        "is_synthetic": True
    }
