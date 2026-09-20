import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, JSON, Text
from database import Base
from config import DEFAULT_PROGRESS_BY_STATUS

class EventModel(Base):
    __tablename__ = "events"

    event_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submitter_id = Column(String, nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    road_segment_id = Column(String, nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    severity = Column(Integer, nullable=False, default=3)
    detected_objects = Column(JSON, default=list, nullable=False)
    description = Column(Text, nullable=False)
    evidence_type = Column(String, nullable=False, default="text")
    image_path = Column(String, nullable=True)
    image_hash = Column(String, nullable=True, index=True)
    confidence = Column(Float, nullable=False, default=0.9)
    is_synthetic = Column(Boolean, nullable=False, default=False)
    period = Column(String, nullable=False, default="before", index=True)
    # Which class of source this observation came from — "citizen_report"
    # (a phone submission) or "cctv_camera" (a fixed traffic/road camera,
    # classified by the same Gemini vision pipeline via
    # POST /api/camera-feeds/ingest). Distinct source *types* co-occurring
    # in a cluster is real cross-source corroboration, not just more of the
    # same kind of evidence — see pipeline.compute_pattern_score.
    evidence_source_type = Column(String, nullable=False, default="citizen_report", index=True)

    # --- Automatic routing: every individual report is sent to a government
    # section (department) for its area (zone) the moment it's created, not
    # only once it becomes part of a detected pattern. ---
    assigned_department = Column(String, nullable=False, default="Municipal Operations (General)")
    assigned_zone = Column(String, nullable=False, default="Unzoned / Citywide")
    status = Column(String, nullable=False, default="new", index=True)
    status_note = Column(Text, nullable=True)
    acknowledge_due_at = Column(DateTime, nullable=True)
    resolve_due_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    status_updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Stored value is nullable ("not explicitly set yet"); the `progress_percent`
    # property below is what API responses read — it falls back to a
    # status-based default so "how far along is it" always has an answer.
    progress_percent_raw = Column("progress_percent", Integer, nullable=True)

    @property
    def progress_percent(self) -> int:
        if self.progress_percent_raw is not None:
            return self.progress_percent_raw
        return DEFAULT_PROGRESS_BY_STATUS.get(self.status, 0)


class EventStatusEventModel(Base):
    """Audit trail of every status change / routing action on an individual report."""
    __tablename__ = "event_status_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)
    department = Column(String, nullable=False)
    zone = Column(String, nullable=False, default="Unzoned / Citywide")
    note = Column(Text, nullable=True)
    actor_label = Column(String, nullable=False, default="City Authority")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class PatternModel(Base):
    __tablename__ = "patterns"

    pattern_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    radius_m = Column(Float, nullable=False, default=50.0)
    score = Column(Float, nullable=False)
    score_breakdown = Column(JSON, nullable=False)
    time_window = Column(String, nullable=False)
    days_observed = Column(Integer, nullable=False)
    event_count = Column(Integer, nullable=False)
    independent_source_count = Column(Integer, nullable=False)
    top_categories = Column(JSON, nullable=False)
    confidence = Column(Float, nullable=False)
    graph = Column(JSON, nullable=False)
    timeline = Column(JSON, nullable=False)
    source_distribution = Column(JSON, nullable=False)
    observed_facts = Column(JSON, nullable=False)
    candidate_explanations = Column(JSON, nullable=False)
    recommended_investigation = Column(JSON, nullable=False)
    disclaimer = Column(String, nullable=False)
    is_synthetic = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Multi-source root-cause evidence gathered at detection time (NOAA,
    # satellite, mobility GPS, public transit, CCTV) — see evidence_sources.py.
    evidence_signals = Column(JSON, nullable=True)

    # --- Government accountability / transparency fields ---
    assigned_department = Column(String, nullable=False, default="Municipal Operations (General)")
    assigned_zone = Column(String, nullable=False, default="Unzoned / Citywide")
    status = Column(String, nullable=False, default="new", index=True)
    status_note = Column(Text, nullable=True)
    acknowledge_due_at = Column(DateTime, nullable=True)
    resolve_due_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    status_updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    progress_percent_raw = Column("progress_percent", Integer, nullable=True)

    @property
    def progress_percent(self) -> int:
        if self.progress_percent_raw is not None:
            return self.progress_percent_raw
        return DEFAULT_PROGRESS_BY_STATUS.get(self.status, 0)


class PatternStatusEventModel(Base):
    """Audit trail of every status change made on a pattern, for public transparency."""
    __tablename__ = "pattern_status_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    pattern_id = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)
    department = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    actor_label = Column(String, nullable=False, default="City Authority")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


# --- Phone-based accounts ---

class UserModel(Base):
    """A registered citizen account, identified by phone number (OTP login, no password)."""
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = Column(String, nullable=False, unique=True, index=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)


class OtpCodeModel(Base):
    """
    Short-lived OTP for phone verification. In this hackathon build there's no
    SMS gateway wired up, so the code is only ever returned to the caller
    while config.DEV_EXPOSE_OTP is on (see auth.py) — swap that send step for
    a real provider (Twilio/MSG91/etc.) to go to production.
    """
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = Column(String, nullable=False, index=True)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed = Column(Boolean, nullable=False, default=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SessionModel(Base):
    """An opaque bearer token issued after successful OTP verification."""
    __tablename__ = "sessions"

    token = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)


# --- Predictive risk escalation ---

class EscalationModel(Base):
    """
    A proactive alert to a department: a case (pattern or individual report)
    has been open past its SLA in a zone where severe weather is forecast —
    i.e. an unresolved problem that could turn into something dangerous.
    Surfaces in the Department Inbox as a notification, since no SMS/email/
    push channel is wired up in this build.
    """
    __tablename__ = "escalations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_type = Column(String, nullable=False)  # 'pattern' | 'event'
    case_id = Column(String, nullable=False, index=True)
    department = Column(String, nullable=False, index=True)
    zone = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    risk_level = Column(String, nullable=False)  # 'elevated' | 'severe'
    reason = Column(Text, nullable=False)
    weather_summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    acknowledged = Column(Boolean, nullable=False, default=False)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)
