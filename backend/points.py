"""
Earn Points / Community Rewards.

Core rule, enforced structurally rather than by trusting callers: every
award writes one row to the append-only `points_ledger` keyed by
(user_id, report_id, action_type). Before writing, we check whether that
exact key already exists — if it does, the action has already been paid
out and nothing happens. That's what makes every rule in the spec "only
once" a property of the data, not a promise in application code.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from config import (
    POINTS_REPORT_ISSUE, POINTS_PHOTO_EVIDENCE, POINTS_TEXT_DESCRIPTION,
    POINTS_ACCURATE_LOCATION, POINTS_VERIFIED_BY_USER, POINTS_AUTHORITY_CONFIRMED,
    POINTS_USEFUL_FOLLOWUP, MIN_MEANINGFUL_TEXT_CHARS, ACCURATE_LOCATION_MIN_OFFSET_DEG,
    SPAM_RATE_LIMIT_WINDOW_MINUTES, SPAM_RATE_LIMIT_MAX_REPORTS, FOLLOWUP_MIN_DAYS_AFTER_REPORT,
    CONTRIBUTION_LEVELS, REWARD_CATALOG, CITY_CENTER_LAT, CITY_CENTER_LON,
)
from models import ReportModel, PointsLedgerModel, RedemptionModel, EventModel

logger = logging.getLogger(__name__)


# --- Anti-abuse ---

def check_spam(db: Session, user_id: Optional[str], image_hash: Optional[str]) -> Tuple[bool, Optional[str]]:
    """Returns (is_spam, reason). A spam-flagged report is stored but earns nothing."""
    if image_hash:
        dup = db.query(EventModel).filter(EventModel.image_hash == image_hash).first()
        if dup:
            return True, "Duplicate image already on file — no points awarded for repeat evidence."

    if user_id:
        window_start = datetime.utcnow() - timedelta(minutes=SPAM_RATE_LIMIT_WINDOW_MINUTES)
        recent_count = (
            db.query(ReportModel)
            .filter(ReportModel.user_id == user_id, ReportModel.created_at >= window_start)
            .count()
        )
        if recent_count >= SPAM_RATE_LIMIT_MAX_REPORTS:
            return True, f"More than {SPAM_RATE_LIMIT_MAX_REPORTS} reports in {SPAM_RATE_LIMIT_WINDOW_MINUTES} minutes — rate-limited as likely spam."

    return False, None


def is_accurate_location(lat: float, lon: float) -> bool:
    """A point suspiciously close to the untouched default map center reads as an un-moved pin, not a real location."""
    return (
        abs(lat - CITY_CENTER_LAT) > ACCURATE_LOCATION_MIN_OFFSET_DEG
        or abs(lon - CITY_CENTER_LON) > ACCURATE_LOCATION_MIN_OFFSET_DEG
    )


def is_meaningful_text(text: Optional[str]) -> bool:
    return bool(text and len(text.strip()) >= MIN_MEANINGFUL_TEXT_CHARS)


# --- Ledger primitive: the actual "only once" enforcement ---

def _already_awarded(db: Session, user_id: str, report_id: Optional[str], action_type: str) -> bool:
    return (
        db.query(PointsLedgerModel)
        .filter(
            PointsLedgerModel.user_id == user_id,
            PointsLedgerModel.report_id == report_id,
            PointsLedgerModel.action_type == action_type,
        )
        .first()
        is not None
    )


def award(
    db: Session, user_id: str, action_type: str, points: int,
    report_id: Optional[str] = None, note: Optional[str] = None
) -> bool:
    """Idempotent award. Returns True if newly awarded, False if this (user, report, action) was already paid out."""
    if _already_awarded(db, user_id, report_id, action_type):
        return False
    db.add(PointsLedgerModel(
        user_id=user_id, report_id=report_id, action_type=action_type,
        points=points, note=note, created_at=datetime.utcnow(),
    ))
    return True


# --- Report creation & the four submission-time awards ---

def create_report(
    db: Session, user_id: Optional[str], lat: float, lon: float,
    text: Optional[str], has_photo: bool, image_hash: Optional[str]
) -> ReportModel:
    """
    Creates the ReportModel for one citizen submission and immediately runs
    the four submission-time awards (report / photo / text / location),
    each independently idempotent and each skipped entirely if the report
    is flagged as spam. No-op (report still created, nothing awarded) for
    anonymous submissions — points require a persistent identity.
    """
    is_spam, spam_reason = check_spam(db, user_id, image_hash if has_photo else None)

    report = ReportModel(
        user_id=user_id,
        created_at=datetime.utcnow(),
        has_photo=has_photo,
        has_meaningful_text=is_meaningful_text(text),
        has_accurate_location=is_accurate_location(lat, lon),
        is_flagged_spam=is_spam,
        spam_reason=spam_reason,
    )
    db.add(report)
    db.flush()

    if user_id and not is_spam:
        award(db, user_id, "report_issue", POINTS_REPORT_ISSUE, report.report_id)
        if report.has_photo:
            award(db, user_id, "photo_evidence", POINTS_PHOTO_EVIDENCE, report.report_id)
        if report.has_meaningful_text:
            award(db, user_id, "text_description", POINTS_TEXT_DESCRIPTION, report.report_id)
        if report.has_accurate_location:
            award(db, user_id, "accurate_location", POINTS_ACCURATE_LOCATION, report.report_id)

    return report


# --- Post-submission awards ---

def verify_report(db: Session, report_id: str, verifier_user_id: str) -> ReportModel:
    """A different citizen confirms this report is real. Awards the reporter once, regardless of how many verify after."""
    report = db.query(ReportModel).filter(ReportModel.report_id == report_id).first()
    if not report:
        raise ValueError("Report not found.")
    if not report.user_id:
        raise ValueError("This report has no registered owner to credit.")
    if report.user_id == verifier_user_id:
        raise ValueError("You can't verify your own report.")
    if report.is_flagged_spam:
        raise ValueError("This report is flagged as spam and can't be verified.")

    if not report.verified_by_user_id:
        report.verified_by_user_id = verifier_user_id
        report.verified_at = datetime.utcnow()

    award(db, report.user_id, "verified_by_user", POINTS_VERIFIED_BY_USER, report.report_id)
    return report


def confirm_by_authority(db: Session, report_id: str) -> Optional[ReportModel]:
    """The first time an officer acts on this report's event (acknowledged/resolved), credit the reporter once."""
    report = db.query(ReportModel).filter(ReportModel.report_id == report_id).first()
    if not report or not report.user_id or report.is_flagged_spam:
        return report
    if not report.authority_confirmed:
        report.authority_confirmed = True
        report.authority_confirmed_at = datetime.utcnow()
    award(db, report.user_id, "authority_confirmed", POINTS_AUTHORITY_CONFIRMED, report.report_id)
    return report


def maybe_confirm_authority_for_event(db: Session, event: EventModel) -> None:
    """Hook called from the event status-update endpoint — event.status has just changed."""
    if not event.report_id:
        return
    if event.status in ("acknowledged", "resolved"):
        confirm_by_authority(db, event.report_id)


def submit_followup(db: Session, report_id: str, user_id: str, text: str) -> Tuple[ReportModel, bool]:
    """
    Owner-only, and only meaningful >= FOLLOWUP_MIN_DAYS_AFTER_REPORT after
    the original report — otherwise it's just re-submitting for free points.
    Returns (report, was_awarded).
    """
    report = db.query(ReportModel).filter(ReportModel.report_id == report_id).first()
    if not report:
        raise ValueError("Report not found.")
    if report.user_id != user_id:
        raise ValueError("Only the original reporter can add a follow-up.")
    if not is_meaningful_text(text):
        raise ValueError(f"Follow-up needs at least {MIN_MEANINGFUL_TEXT_CHARS} characters of real detail.")

    days_open = (datetime.utcnow() - report.created_at).days
    if days_open < FOLLOWUP_MIN_DAYS_AFTER_REPORT:
        raise ValueError(
            f"Follow-ups only count after {FOLLOWUP_MIN_DAYS_AFTER_REPORT} days "
            f"(this report is {days_open}d old)."
        )

    report.followup_text = text
    report.followup_submitted_at = datetime.utcnow()

    awarded = False
    if not report.followup_awarded and not report.is_flagged_spam:
        awarded = award(db, user_id, "useful_followup", POINTS_USEFUL_FOLLOWUP, report.report_id)
        if awarded:
            report.followup_awarded = True

    return report, awarded


# --- Summary, levels, rewards ---

def get_level_info(total_earned: int) -> Dict[str, Any]:
    current = CONTRIBUTION_LEVELS[0]
    next_level = None
    for lvl in CONTRIBUTION_LEVELS:
        if total_earned >= lvl["min_points"]:
            current = lvl
        else:
            next_level = lvl
            break

    if next_level is None:
        return {
            "level": current["level"],
            "next_level": None,
            "points_to_next": 0,
            "progress_pct": 100.0,
        }

    span = next_level["min_points"] - current["min_points"]
    progressed = total_earned - current["min_points"]
    progress_pct = round(min(100.0, max(0.0, (progressed / span) * 100.0)), 1) if span > 0 else 100.0

    return {
        "level": current["level"],
        "next_level": next_level["level"],
        "next_level_points": next_level["min_points"],
        "points_to_next": max(0, next_level["min_points"] - total_earned),
        "progress_pct": progress_pct,
    }


def get_points_summary(db: Session, user_id: str) -> Dict[str, Any]:
    ledger_rows = db.query(PointsLedgerModel).filter(PointsLedgerModel.user_id == user_id).all()
    total_earned = sum(r.points for r in ledger_rows)

    redemptions = db.query(RedemptionModel).filter(RedemptionModel.user_id == user_id).all()
    total_redeemed = sum(r.points_spent for r in redemptions)

    valid_reports = (
        db.query(ReportModel)
        .filter(ReportModel.user_id == user_id, ReportModel.is_flagged_spam == False)  # noqa: E712
        .all()
    )
    verified_count = sum(1 for r in valid_reports if r.verified_by_user_id)

    level_info = get_level_info(total_earned)

    return {
        "total_points_earned": total_earned,
        "points_redeemed": total_redeemed,
        "points_remaining": total_earned - total_redeemed,
        "verified_reports": verified_count,
        "issues_contributed": len(valid_reports),
        **level_info,
    }


def redeem_reward(db: Session, user_id: str, reward_id: str) -> RedemptionModel:
    reward = next((r for r in REWARD_CATALOG if r["id"] == reward_id), None)
    if not reward:
        raise ValueError("Unknown reward.")

    summary = get_points_summary(db, user_id)
    if summary["points_remaining"] < reward["points_required"]:
        raise ValueError(
            f"Not enough points: need {reward['points_required']}, have {summary['points_remaining']}."
        )

    redemption = RedemptionModel(
        user_id=user_id,
        reward_id=reward["id"],
        reward_name=reward["name"],
        points_spent=reward["points_required"],
        redeemed_at=datetime.utcnow(),
    )
    db.add(redemption)
    return redemption


def list_redemptions(db: Session, user_id: str) -> List[RedemptionModel]:
    return (
        db.query(RedemptionModel)
        .filter(RedemptionModel.user_id == user_id)
        .order_by(RedemptionModel.redeemed_at.desc())
        .all()
    )


def get_verifiable_reports(db: Session, exclude_user_id: Optional[str], limit: int = 20) -> List[Dict[str, Any]]:
    """Recent, non-spam, not-yet-verified reports by *other* users, for the community verification panel."""
    query = db.query(ReportModel).filter(
        ReportModel.is_flagged_spam == False,  # noqa: E712
        ReportModel.verified_by_user_id.is_(None),
        ReportModel.user_id.isnot(None),
    )
    if exclude_user_id:
        query = query.filter(ReportModel.user_id != exclude_user_id)

    reports = query.order_by(ReportModel.created_at.desc()).limit(limit).all()

    results = []
    for report in reports:
        first_event = (
            db.query(EventModel)
            .filter(EventModel.report_id == report.report_id)
            .order_by(EventModel.timestamp.asc())
            .first()
        )
        if not first_event:
            continue
        results.append({
            "report_id": report.report_id,
            "created_at": report.created_at,
            "category": first_event.category,
            "description": first_event.description,
            "image_path": first_event.image_path,
            "lat": first_event.lat,
            "lon": first_event.lon,
        })
    return results
