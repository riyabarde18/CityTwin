"""
Government accountability & transparency layer.

Turns a citizen report — a single observation or a detected multi-source
pattern — from an anonymous "complaint" into a routed, tracked civic case:
which government section (department) in which area (zone) owns it, what the
response-time target is, and a public audit trail of every status change.

Routing happens automatically and immediately:
 - Every individual report is routed the moment it's created (see
   `initialize_event_governance`, called from `POST /api/observations`).
 - Every emergent multi-source pattern is routed the moment it's detected
   (see `initialize_governance_fields`, called from `POST /api/analyze`).

This is what lets CityTwin show citizens *who* is responsible and *whether*
anything happened after their report — not just that AI found a pattern.
"""
import logging
import math
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Union

from sqlalchemy.orm import Session

from config import (
    CATEGORY_TO_DEPARTMENT, DEFAULT_DEPARTMENT, PATTERN_STATUSES,
    DEFAULT_STATUS, SLA_DAYS_TO_ACKNOWLEDGE, SLA_DAYS_TO_RESOLVE,
    CITY_ZONES, DEFAULT_ZONE_NAME, EARTH_RADIUS_METERS, DEFAULT_PROGRESS_BY_STATUS
)
from models import PatternModel, PatternStatusEventModel, EventModel, EventStatusEventModel

logger = logging.getLogger(__name__)

GovernedCase = Union[PatternModel, EventModel]


def assign_department(categories: List[str]) -> str:
    """Routes a case to the department tied to its dominant (first/most frequent) category."""
    if not categories:
        return DEFAULT_DEPARTMENT
    return CATEGORY_TO_DEPARTMENT.get(categories[0], DEFAULT_DEPARTMENT)


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = EARTH_RADIUS_METERS
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def assign_zone(lat: Optional[float], lon: Optional[float]) -> str:
    """
    Routes a case to the jurisdiction (ward) whose center it's nearest to.
    See config.CITY_ZONES for why this is nearest-center rather than real
    ward polygons. Always returns a zone — every coordinate belongs to its
    closest ward in this model, with DEFAULT_ZONE_NAME only as a fallback
    for missing coordinates.
    """
    if lat is None or lon is None or not CITY_ZONES:
        return DEFAULT_ZONE_NAME
    best_zone = None
    best_dist = float("inf")
    for zone in CITY_ZONES:
        d = _haversine_meters(lat, lon, zone["center_lat"], zone["center_lon"])
        if d < best_dist:
            best_dist = d
            best_zone = zone
    return best_zone["name"] if best_zone else DEFAULT_ZONE_NAME


def compute_due_dates(created_at: datetime) -> Dict[str, datetime]:
    """SLA due dates for first acknowledgement and for resolution, from creation time."""
    return {
        "acknowledge_due_at": created_at + timedelta(days=SLA_DAYS_TO_ACKNOWLEDGE),
        "resolve_due_at": created_at + timedelta(days=SLA_DAYS_TO_RESOLVE),
    }


def is_overdue(case: GovernedCase, now: Optional[datetime] = None) -> bool:
    """A case is overdue if it's still open past its acknowledge/resolve SLA."""
    now = now or datetime.utcnow()
    if case.status in ("resolved", "rejected"):
        return False
    if case.status == "new" and case.acknowledge_due_at and now > case.acknowledge_due_at:
        return True
    if case.status in ("new", "acknowledged", "in_progress") and case.resolve_due_at and now > case.resolve_due_at:
        return True
    return False


def initialize_governance_fields(pattern: PatternModel, created_at: datetime) -> None:
    """Auto-routes a freshly detected pattern: department, zone, status, SLA due dates."""
    pattern.assigned_department = assign_department(pattern.top_categories or [])
    pattern.assigned_zone = assign_zone(pattern.center_lat, pattern.center_lon)
    pattern.status = DEFAULT_STATUS
    due = compute_due_dates(created_at)
    pattern.acknowledge_due_at = due["acknowledge_due_at"]
    pattern.resolve_due_at = due["resolve_due_at"]
    pattern.status_updated_at = created_at


def initialize_event_governance(event: EventModel, created_at: datetime) -> None:
    """
    Auto-routes an individual citizen report the instant it's created — this
    is the "automatically report it to that government section in that area"
    behavior: every report gets a department (by category) and a zone (by
    location) with no waiting for pattern detection.
    """
    event.assigned_department = assign_department([event.category])
    event.assigned_zone = assign_zone(event.lat, event.lon)
    event.status = DEFAULT_STATUS
    due = compute_due_dates(created_at)
    event.acknowledge_due_at = due["acknowledge_due_at"]
    event.resolve_due_at = due["resolve_due_at"]
    event.status_updated_at = created_at


VALID_TRANSITIONS = {
    "new": {"acknowledged", "in_progress", "rejected"},
    "acknowledged": {"in_progress", "resolved", "rejected"},
    "in_progress": {"resolved", "rejected", "acknowledged"},
    "resolved": {"in_progress"},  # allow re-opening if it recurs
    "rejected": {"acknowledged", "in_progress"},  # allow re-opening on appeal
}


def _apply_transition(
    case: GovernedCase, new_status: str, department: Optional[str], progress_percent: Optional[int]
) -> datetime:
    """Shared validation + field mutation for both patterns and individual events."""
    if new_status not in PATTERN_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of: {PATTERN_STATUSES}")

    allowed_next = VALID_TRANSITIONS.get(case.status, set())
    if new_status != case.status and new_status not in allowed_next:
        raise ValueError(
            f"Cannot move from '{case.status}' to '{new_status}'. "
            f"Allowed next steps: {sorted(allowed_next) or 'none'}."
        )

    if progress_percent is not None and not (0 <= progress_percent <= 100):
        raise ValueError("progress_percent must be between 0 and 100.")

    now = datetime.utcnow()
    if department:
        case.assigned_department = department
    case.status = new_status
    case.status_updated_at = now
    if progress_percent is not None:
        case.progress_percent_raw = progress_percent
    elif new_status in DEFAULT_PROGRESS_BY_STATUS:
        # Advance the default alongside the stage unless an officer pinned a
        # specific number earlier (only auto-advance forward, never backward).
        default_for_stage = DEFAULT_PROGRESS_BY_STATUS[new_status]
        if case.progress_percent_raw is None or default_for_stage > case.progress_percent_raw:
            case.progress_percent_raw = default_for_stage

    if new_status == "acknowledged" and not case.acknowledged_at:
        case.acknowledged_at = now
    if new_status == "resolved":
        case.resolved_at = now
    if new_status == "in_progress" and case.resolved_at:
        case.resolved_at = None  # re-opened after a prior resolution

    return now


def apply_status_update(
    db: Session,
    pattern: PatternModel,
    new_status: str,
    department: Optional[str],
    note: Optional[str],
    actor_label: Optional[str],
    progress_percent: Optional[int] = None,
) -> PatternStatusEventModel:
    """Validates and applies a status transition on a pattern, logging it to the audit trail."""
    now = _apply_transition(pattern, new_status, department, progress_percent)
    pattern.status_note = note

    log_entry = PatternStatusEventModel(
        pattern_id=pattern.pattern_id,
        status=new_status,
        department=pattern.assigned_department,
        note=note,
        actor_label=actor_label or "City Authority",
        created_at=now,
    )
    db.add(log_entry)
    return log_entry


def apply_event_status_update(
    db: Session,
    event: EventModel,
    new_status: str,
    department: Optional[str],
    note: Optional[str],
    actor_label: Optional[str],
    progress_percent: Optional[int] = None,
) -> EventStatusEventModel:
    """Validates and applies a status transition on an individual report, logging it."""
    now = _apply_transition(event, new_status, department, progress_percent)
    event.status_note = note

    log_entry = EventStatusEventModel(
        event_id=event.event_id,
        status=new_status,
        department=event.assigned_department,
        zone=event.assigned_zone,
        note=note,
        actor_label=actor_label or "City Authority",
        created_at=now,
    )
    db.add(log_entry)
    return log_entry


def build_transparency_summary(patterns: List[PatternModel]) -> Dict[str, Any]:
    """Aggregates department-level accountability metrics for the public dashboard."""
    by_dept: Dict[str, Dict[str, Any]] = {}
    total_resolved = 0
    total_overdue = 0
    resolution_days: List[float] = []

    for p in patterns:
        dept = p.assigned_department or DEFAULT_DEPARTMENT
        row = by_dept.setdefault(dept, {
            "department": dept, "total": 0, "new": 0, "acknowledged": 0,
            "in_progress": 0, "resolved": 0, "rejected": 0, "overdue": 0,
            "_resolution_days": []
        })
        row["total"] += 1
        row[p.status] = row.get(p.status, 0) + 1

        overdue = is_overdue(p)
        if overdue:
            row["overdue"] += 1
            total_overdue += 1

        if p.status == "resolved":
            total_resolved += 1
            if p.resolved_at and p.created_at:
                days = (p.resolved_at - p.created_at).total_seconds() / 86400.0
                row["_resolution_days"].append(days)
                resolution_days.append(days)

    dept_stats = []
    for row in by_dept.values():
        days_list = row.pop("_resolution_days")
        avg_days = round(sum(days_list) / len(days_list), 1) if days_list else None
        row["avg_resolution_days"] = avg_days
        dept_stats.append(row)

    citywide_avg = round(sum(resolution_days) / len(resolution_days), 1) if resolution_days else None

    return {
        "total_patterns": len(patterns),
        "total_resolved": total_resolved,
        "total_overdue": total_overdue,
        "citywide_avg_resolution_days": citywide_avg,
        "by_department": sorted(dept_stats, key=lambda r: r["department"]),
    }
