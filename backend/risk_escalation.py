"""
Predictive risk escalation: notifies the responsible department when a
problem has been open too long AND severe weather is forecast for its zone —
i.e. an unresolved issue (e.g. a blocked drain) that's about to meet the
conditions (heavy rain) that turn it into something dangerous (flooding).

Weather comes from Open-Meteo's free, keyless forecast API. If that call
fails (offline demo, rate limit, etc.) the scan degrades gracefully to "no
weather-based escalations this run" rather than raising — this must never
break the caller (`POST /api/analyze`, or the manual scan endpoint).

No SMS/email/push channel is wired up in this build (no gateway credentials
available in a hackathon environment): "sends a notification to the
government committee" is implemented as an in-app Escalation record that
appears immediately in the Department Inbox. Swap `_notify` for a real
channel to go to production — everything upstream of it already works.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import requests
from sqlalchemy.orm import Session

from config import (
    CITY_ZONES, WEATHER_SENSITIVE_CATEGORIES, OPEN_METEO_FORECAST_URL,
    WEATHER_FORECAST_DAYS, WEATHER_REQUEST_TIMEOUT_SECONDS,
    RISK_THRESHOLD_ELEVATED, RISK_THRESHOLD_SEVERE, ESCALATION_DEDUPE_HOURS,
    DEMO_FORCE_WEATHER_RISK
)
from models import PatternModel, EventModel, EscalationModel
import governance

logger = logging.getLogger(__name__)


def fetch_weather_risk(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Checks Open-Meteo's forecast for the next WEATHER_FORECAST_DAYS days at
    this point. Returns None if there's no elevated/severe risk, or if the
    request fails for any reason (never raises).
    """
    if DEMO_FORCE_WEATHER_RISK:
        # Explicit opt-in only (env var) — a live demo can't control whether
        # it's actually raining wherever CITY_CENTER points, so this lets a
        # presenter show the full escalation path on demand. Always clearly
        # labeled as simulated, never silently substituted for real data.
        return {
            "risk_level": "severe",
            "precipitation_probability_max_pct": 95,
            "precipitation_sum_mm": 45.0,
            "forecast_days": WEATHER_FORECAST_DAYS,
            "source": "simulated (DEMO_FORCE_WEATHER_RISK=true)",
        }
    try:
        resp = requests.get(
            OPEN_METEO_FORECAST_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "precipitation_probability_max,precipitation_sum",
                "forecast_days": WEATHER_FORECAST_DAYS,
                "timezone": "auto",
            },
            timeout=WEATHER_REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        probs = daily.get("precipitation_probability_max", []) or []
        sums = daily.get("precipitation_sum", []) or []
        if not probs or not sums:
            return None

        max_prob = max(probs)
        total_mm = sum(sums)

        if max_prob >= RISK_THRESHOLD_SEVERE["probability_pct"] and total_mm >= RISK_THRESHOLD_SEVERE["precip_mm"]:
            level = "severe"
        elif max_prob >= RISK_THRESHOLD_ELEVATED["probability_pct"] and total_mm >= RISK_THRESHOLD_ELEVATED["precip_mm"]:
            level = "elevated"
        else:
            return None

        return {
            "risk_level": level,
            "precipitation_probability_max_pct": max_prob,
            "precipitation_sum_mm": round(total_mm, 1),
            "forecast_days": WEATHER_FORECAST_DAYS,
            "source": "open-meteo.com",
        }
    except Exception as e:
        logger.warning(f"Weather risk check failed for ({lat}, {lon}): {e}")
        return None


def _zone_weather_cache(db_lookup_zones: List[dict]) -> Dict[str, Optional[Dict[str, Any]]]:
    """One weather call per zone per scan, not per case — forecasts are area-level anyway."""
    cache: Dict[str, Optional[Dict[str, Any]]] = {}
    for zone in db_lookup_zones:
        cache[zone["name"]] = fetch_weather_risk(zone["center_lat"], zone["center_lon"])
    return cache


def _recent_unacknowledged_exists(db: Session, case_type: str, case_id: str) -> bool:
    cutoff = datetime.utcnow() - timedelta(hours=ESCALATION_DEDUPE_HOURS)
    existing = (
        db.query(EscalationModel)
        .filter(
            EscalationModel.case_type == case_type,
            EscalationModel.case_id == case_id,
            EscalationModel.acknowledged == False,  # noqa: E712
            EscalationModel.created_at >= cutoff,
        )
        .first()
    )
    return existing is not None


def _breach_description(case, now: datetime) -> str:
    """
    is_overdue() can trip on either SLA — never acknowledged within 2 days,
    or still open past the 14-day resolve target. These are different
    severities of neglect, so the officer-facing reason should say which.
    """
    if case.status == "new" and case.acknowledge_due_at and now > case.acknowledge_due_at:
        days_late = (now - case.acknowledge_due_at).days
        return f"not yet acknowledged, {days_late}d past the 2-day target"
    if case.resolve_due_at and now > case.resolve_due_at:
        days_late = (now - case.resolve_due_at).days
        return f"still unresolved, {days_late}d past the 14-day target"
    return "past its response target"


def scan_for_escalations(db: Session) -> List[EscalationModel]:
    """
    Finds open cases (patterns and individual reports) that are overdue AND
    sit in a zone with elevated/severe weather forecast, and files a new
    Escalation for each one not already actively flagged. Returns the newly
    created escalations (empty list if nothing qualifies, including if the
    weather API is unreachable).
    """
    weather_by_zone = _zone_weather_cache(CITY_ZONES)
    if not any(weather_by_zone.values()):
        logger.info("Risk scan: no zones currently show elevated/severe weather risk.")
        return []

    created: List[EscalationModel] = []
    now = datetime.utcnow()

    # --- Detected patterns ---
    open_patterns = db.query(PatternModel).filter(
        PatternModel.status.notin_(["resolved", "rejected"])
    ).all()
    for pattern in open_patterns:
        if not governance.is_overdue(pattern, now):
            continue
        dominant_cat = (pattern.top_categories or [None])[0]
        if dominant_cat not in WEATHER_SENSITIVE_CATEGORIES:
            continue
        weather = weather_by_zone.get(pattern.assigned_zone)
        if not weather:
            continue
        if _recent_unacknowledged_exists(db, "pattern", pattern.pattern_id):
            continue

        reason = (
            f"Pattern in {pattern.assigned_zone} is {_breach_description(pattern, now)} "
            f"({dominant_cat.replace('_', ' ')}, {pattern.event_count} reports). "
            f"{weather['risk_level'].title()} rain risk forecast: "
            f"{weather['precipitation_probability_max_pct']}% probability, "
            f"{weather['precipitation_sum_mm']}mm over next {weather['forecast_days']}d — "
            f"unresolved issue may worsen."
        )
        esc = EscalationModel(
            case_type="pattern", case_id=pattern.pattern_id,
            department=pattern.assigned_department, zone=pattern.assigned_zone,
            category=dominant_cat, risk_level=weather["risk_level"], reason=reason,
            weather_summary=weather, created_at=now,
        )
        db.add(esc)
        created.append(esc)

    # --- Individual reports ---
    open_events = db.query(EventModel).filter(
        EventModel.period == "before",
        EventModel.status.notin_(["resolved", "rejected"]),
        EventModel.category.in_(WEATHER_SENSITIVE_CATEGORIES),
    ).all()
    for event in open_events:
        if not governance.is_overdue(event, now):
            continue
        weather = weather_by_zone.get(event.assigned_zone)
        if not weather:
            continue
        if _recent_unacknowledged_exists(db, "event", event.event_id):
            continue

        reason = (
            f"Report in {event.assigned_zone} is {_breach_description(event, now)} "
            f"({event.category.replace('_', ' ')}). "
            f"{weather['risk_level'].title()} rain risk forecast: "
            f"{weather['precipitation_probability_max_pct']}% probability, "
            f"{weather['precipitation_sum_mm']}mm over next {weather['forecast_days']}d — "
            f"unresolved issue may worsen."
        )
        esc = EscalationModel(
            case_type="event", case_id=event.event_id,
            department=event.assigned_department, zone=event.assigned_zone,
            category=event.category, risk_level=weather["risk_level"], reason=reason,
            weather_summary=weather, created_at=now,
        )
        db.add(esc)
        created.append(esc)

    if created:
        db.commit()
        for e in created:
            db.refresh(e)
        logger.info(f"Risk scan: filed {len(created)} new escalation(s).")

    return created
