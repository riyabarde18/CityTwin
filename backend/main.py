import os
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from config import IS_MOCK_MODE, UPLOADS_DIR, DISCLAIMER, PATTERN_STATUSES, REWARD_CATALOG, COMMUNITY_PARTNERS
from database import Base, engine, get_db
from models import (
    EventModel, PatternModel, PatternStatusEventModel, EventStatusEventModel,
    UserModel, EscalationModel, ReportModel, PointsLedgerModel
)
from schemas import (
    HealthResponse, EventSchema, PatternSummarySchema, PatternDetailSchema,
    InterventionsSimulateRequest, InterventionsSimulateResponse, CenterCoordinates,
    StatusUpdateRequest, StatusLogEntrySchema, MyReportItemSchema, TransparencySummarySchema,
    UserSchema, RequestOtpSchema, RequestOtpResponse, VerifyOtpSchema, AuthResponse,
    EscalationSchema, AcknowledgeEscalationRequest, PointsSummarySchema, RewardSchema,
    RedemptionSchema, RedeemRewardRequest, VerifiableReportSchema, FollowupRequest,
    CommunityPartnerSchema, ObservationSubmitResponse
)
from perception import run_perception, compute_image_hash
from pipeline import run_full_pipeline
from seed import generate_seed_data
from simulator import simulate_intervention
import governance
import auth as auth_module
import risk_escalation
import points as points_module

# Initialize database tables
Base.metadata.create_all(bind=engine, checkfirst=True)

logger = logging.getLogger("citytwin")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CityTwin Backend MVP API",
    description="Emerging Urban Problem Perception & Relationship Discovery Engine",
    version="1.0.0"
)

# Enable CORS for http://localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file uploads directory
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """FastAPI dependency: resolves the logged-in user from a Bearer token, or None."""
    token = auth_module.optional_auth_dep(authorization)
    if not token:
        return None
    return auth_module.get_user_from_token(db, token)


def get_required_user(
    user: Optional[UserModel] = Depends(get_optional_user)
) -> UserModel:
    """FastAPI dependency: 401s if not logged in — for endpoints that need a persistent identity (points, rewards)."""
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to use this feature.")
    return user


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Returns server health status and whether MOCK mode is active."""
    return HealthResponse(
        status="ok",
        mock_mode=IS_MOCK_MODE
    )


# --- Phone-based accounts ---

@app.post("/api/auth/request-otp", response_model=RequestOtpResponse)
def request_otp(req: RequestOtpSchema, db: Session = Depends(get_db)):
    """
    Issues a one-time code for a phone number. No SMS gateway is configured
    in this build, so the code is logged server-side and — only in dev mode —
    also returned here so the flow is demoable without one.
    """
    try:
        result = auth_module.request_otp(db, req.phone_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.post("/api/auth/verify-otp", response_model=AuthResponse)
def verify_otp(req: VerifyOtpSchema, db: Session = Depends(get_db)):
    """Verifies the code, creating the account on first login, and returns a session token."""
    try:
        user, token = auth_module.verify_otp(db, req.phone_number, req.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AuthResponse(token=token, user=UserSchema.model_validate(user))


@app.get("/api/auth/me", response_model=UserSchema)
def get_me(user: Optional[UserModel] = Depends(get_optional_user)):
    """Returns the currently authenticated user, or 401 if the token is missing/invalid."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user


@app.post("/api/observations", response_model=ObservationSubmitResponse)
async def create_observation(
    image: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    lat: float = Form(...),
    lon: float = Form(...),
    submitter_id: Optional[str] = Form(None),
    timestamp: Optional[str] = Form(None),
    road_segment_id: Optional[str] = Form(None),
    current_user: Optional[UserModel] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Ingests citizen observation (photo, text, GPS, timestamp).
    Runs perception step (Gemini / Mock) and stores 1+ detected events in DB.

    If the caller is logged in (Bearer token), the report is attributed to
    their verified phone number regardless of what `submitter_id` was sent —
    this is what makes "independent submitters" in the pattern score mean
    independent *people*, not just distinct strings a client happened to send.
    Anonymous submission (a free-text submitter_id) is still accepted so the
    demo/seed flow keeps working without requiring login.
    """
    if current_user:
        submitter_id = current_user.phone_number
    elif not submitter_id:
        raise HTTPException(
            status_code=400,
            detail="Log in, or provide a submitter_id for an anonymous report."
        )

    image_bytes = None
    image_path = None
    image_hash_val = None

    if image:
        image_bytes = await image.read()
        if image_bytes:
            filename = f"obs_{uuid.uuid4().hex[:10]}_{image.filename}"
            saved_file_path = UPLOADS_DIR / filename
            with open(saved_file_path, "wb") as f:
                f.write(image_bytes)
            image_path = f"/uploads/{filename}"
            image_hash_val = compute_image_hash(image_bytes)

    # Parse timestamp
    event_timestamp = datetime.utcnow()
    if timestamp:
        try:
            event_timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            pass

    # Run perception step
    perception_events = run_perception(text=text, image_bytes=image_bytes)

    # Earn Points: one Report ties this whole submission together, however
    # many category-events perception splits it into — points are evaluated
    # per report, not per resulting event. Anonymous submissions (no logged
    # in user) still create a report for record-keeping but earn nothing.
    report = points_module.create_report(
        db, user_id=current_user.user_id if current_user else None,
        lat=lat, lon=lon, text=text,
        has_photo=bool(image_bytes), image_hash=image_hash_val,
    )

    created_events = []
    evidence_type = "photo" if image else "text"
    routed_at = datetime.utcnow()  # SLA clock starts when the report reaches the system

    for p_event in perception_events:
        db_event = EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id=submitter_id,
            lat=lat,
            lon=lon,
            road_segment_id=road_segment_id,
            timestamp=event_timestamp,
            category=p_event.category,
            severity=p_event.severity,
            detected_objects=p_event.detected_objects,
            description=p_event.short_description,
            evidence_type=evidence_type,
            image_path=image_path,
            image_hash=image_hash_val,
            confidence=p_event.confidence,
            is_synthetic=False,
            period="before",
            report_id=report.report_id,
        )

        # Auto-route immediately: no waiting for pattern detection. Every
        # single report is sent straight to the department responsible for
        # its category, in the ward its coordinates fall in.
        governance.initialize_event_governance(db_event, routed_at)

        db.add(db_event)
        db.flush()  # assigns event_id-backed row so the FK-ish event_id below is stable
        db.add(EventStatusEventModel(
            event_id=db_event.event_id,
            status=db_event.status,
            department=db_event.assigned_department,
            zone=db_event.assigned_zone,
            note="Auto-routed by CityTwin on submission.",
            actor_label="CityTwin System",
            created_at=routed_at
        ))
        created_events.append(db_event)

    db.commit()
    for e in created_events:
        db.refresh(e)

    # What THIS submission earned (not the lifetime total) — sum the ledger
    # rows just created for this report_id.
    points_awarded = 0
    if current_user:
        rows = (
            db.query(PointsLedgerModel)
            .filter(PointsLedgerModel.report_id == report.report_id)
            .with_entities(PointsLedgerModel.points)
            .all()
        )
        points_awarded = sum(p[0] for p in rows)

    return ObservationSubmitResponse(
        events=created_events,
        points_awarded=points_awarded,
        is_spam=report.is_flagged_spam,
        spam_reason=report.spam_reason,
    )


@app.post("/api/camera-feeds/ingest", response_model=List[EventSchema])
async def ingest_camera_feed(
    image: UploadFile = File(..., description="Snapshot from a fixed traffic/road camera"),
    camera_id: str = Form(..., description="e.g. 'CAM_MAIN_ST_04'"),
    lat: float = Form(...),
    lon: float = Form(...),
    text: Optional[str] = Form(None),
    timestamp: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Real computer-vision ingestion from fixed infrastructure (CCTV/traffic
    cameras), not a citizen's phone. Classified by the same Gemini vision
    perception used for citizen photos (perception.run_perception) — this is
    what makes it a genuinely independent evidence source rather than a
    relabeled citizen report: a camera at a fixed location either does or
    doesn't see a hazard, with no reporting-behavior bias.
    """
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")

    filename = f"cam_{camera_id}_{uuid.uuid4().hex[:8]}_{image.filename}"
    saved_file_path = UPLOADS_DIR / filename
    with open(saved_file_path, "wb") as f:
        f.write(image_bytes)
    image_path = f"/uploads/{filename}"
    image_hash_val = compute_image_hash(image_bytes)

    event_timestamp = datetime.utcnow()
    if timestamp:
        try:
            event_timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            pass

    perception_events = run_perception(text=text, image_bytes=image_bytes)

    created_events = []
    routed_at = datetime.utcnow()

    for p_event in perception_events:
        db_event = EventModel(
            event_id=str(uuid.uuid4()),
            submitter_id=camera_id,
            lat=lat,
            lon=lon,
            timestamp=event_timestamp,
            category=p_event.category,
            severity=p_event.severity,
            detected_objects=p_event.detected_objects,
            description=p_event.short_description,
            evidence_type="photo",
            evidence_source_type="cctv_camera",
            image_path=image_path,
            image_hash=image_hash_val,
            confidence=p_event.confidence,
            is_synthetic=False,
            period="before"
        )
        governance.initialize_event_governance(db_event, routed_at)
        db.add(db_event)
        db.flush()
        db.add(EventStatusEventModel(
            event_id=db_event.event_id,
            status=db_event.status,
            department=db_event.assigned_department,
            zone=db_event.assigned_zone,
            note=f"Auto-routed by CityTwin (camera {camera_id}).",
            actor_label="CityTwin System",
            created_at=routed_at
        ))
        created_events.append(db_event)

    db.commit()
    for e in created_events:
        db.refresh(e)

    return created_events


@app.get("/api/camera-feeds", response_model=List[EventSchema])
def get_camera_feeds(db: Session = Depends(get_db)):
    """Lists all camera-sourced observations (evidence_source_type='cctv_camera')."""
    return (
        db.query(EventModel)
        .filter(EventModel.evidence_source_type == "cctv_camera")
        .order_by(EventModel.timestamp.desc())
        .all()
    )


@app.get("/api/events", response_model=List[EventSchema])
def get_events(
    period: Optional[str] = Query(None, description="Filter by period ('before' or 'after')"),
    db: Session = Depends(get_db)
):
    """Returns all events stored in the database, optionally filtered by period."""
    query = db.query(EventModel)
    if period in ["before", "after"]:
        query = query.filter(EventModel.period == period)
    return query.order_by(EventModel.timestamp.desc()).all()


@app.post("/api/seed")
def seed_database(db: Session = Depends(get_db)):
    """Clears the DB and loads synthetic demo data (hotspot, decoy, noise)."""
    count = generate_seed_data(db)
    return {
        "status": "ok",
        "message": f"Database successfully cleared and seeded with {count} synthetic events.",
        "events_created": count,
        "is_synthetic": True
    }


@app.post("/api/analyze", response_model=List[PatternSummarySchema])
def analyze_patterns(db: Session = Depends(get_db)):
    """Runs the full 7-step analysis pipeline on stored 'before' events."""
    all_events = db.query(EventModel).all()
    if not all_events:
        generate_seed_data(db)
        all_events = db.query(EventModel).all()

    detected_patterns_data = run_full_pipeline(all_events)

    # Clear previous pattern records
    db.query(PatternModel).delete()
    db.commit()

    saved_summaries = []

    for pat_dict in detected_patterns_data:
        pattern_id = str(uuid.uuid4())
        cluster_events = pat_dict.pop("cluster_events", [])
        created_at = datetime.utcnow()

        db_pattern = PatternModel(
            pattern_id=pattern_id,
            center_lat=pat_dict["center_lat"],
            center_lon=pat_dict["center_lon"],
            radius_m=pat_dict["radius_m"],
            score=pat_dict["score"],
            score_breakdown=pat_dict["score_breakdown"],
            time_window=pat_dict["time_window"],
            days_observed=pat_dict["days_observed"],
            event_count=pat_dict["event_count"],
            independent_source_count=pat_dict["independent_source_count"],
            top_categories=pat_dict["top_categories"],
            confidence=pat_dict["confidence"],
            graph=pat_dict["graph"],
            timeline=pat_dict["timeline"],
            source_distribution=pat_dict["source_distribution"],
            observed_facts=pat_dict["observed_facts"],
            candidate_explanations=pat_dict["candidate_explanations"],
            recommended_investigation=pat_dict["recommended_investigation"],
            disclaimer=pat_dict["disclaimer"],
            is_synthetic=pat_dict["is_synthetic"],
            evidence_signals=pat_dict.get("evidence_signals"),
            created_at=created_at
        )

        # Route to a responsible department and set SLA due dates/audit trail
        governance.initialize_governance_fields(db_pattern, created_at)
        db.add(db_pattern)
        db.flush()
        db.add(PatternStatusEventModel(
            pattern_id=pattern_id,
            status=db_pattern.status,
            department=db_pattern.assigned_department,
            note="Pattern auto-detected and routed by CityTwin.",
            actor_label="CityTwin System",
            created_at=created_at
        ))
        db.commit()

        saved_summaries.append(PatternSummarySchema(
            id=pattern_id,
            center=CenterCoordinates(lat=pat_dict["center_lat"], lon=pat_dict["center_lon"]),
            score=pat_dict["score"],
            top_categories=pat_dict["top_categories"],
            time_window=pat_dict["time_window"],
            event_count=pat_dict["event_count"],
            independent_source_count=pat_dict["independent_source_count"],
            confidence=pat_dict["confidence"],
            is_synthetic=pat_dict["is_synthetic"],
            assigned_department=db_pattern.assigned_department,
            assigned_zone=db_pattern.assigned_zone,
            status=db_pattern.status,
            acknowledge_due_at=db_pattern.acknowledge_due_at,
            resolve_due_at=db_pattern.resolve_due_at,
            is_overdue=governance.is_overdue(db_pattern),
            status_updated_at=db_pattern.status_updated_at,
            progress_percent=db_pattern.progress_percent
        ))

    # Best-effort predictive risk scan: never let a weather API hiccup break
    # the core analysis response.
    try:
        risk_escalation.scan_for_escalations(db)
    except Exception as e:
        logger.warning(f"Risk escalation scan failed (non-fatal): {e}")

    return saved_summaries


@app.get("/api/patterns", response_model=List[PatternSummarySchema])
def list_patterns(db: Session = Depends(get_db)):
    """Returns summary list of all detected patterns."""
    patterns = db.query(PatternModel).all()
    results = []
    for p in patterns:
        results.append(PatternSummarySchema(
            id=p.pattern_id,
            center=CenterCoordinates(lat=p.center_lat, lon=p.center_lon),
            score=p.score,
            top_categories=p.top_categories,
            time_window=p.time_window,
            event_count=p.event_count,
            independent_source_count=p.independent_source_count,
            confidence=p.confidence,
            is_synthetic=p.is_synthetic,
            assigned_department=p.assigned_department,
            assigned_zone=p.assigned_zone,
            status=p.status,
            acknowledge_due_at=p.acknowledge_due_at,
            resolve_due_at=p.resolve_due_at,
            is_overdue=governance.is_overdue(p),
            status_updated_at=p.status_updated_at,
            progress_percent=p.progress_percent
        ))
    return results


@app.get("/api/patterns/{pattern_id}", response_model=PatternDetailSchema)
def get_pattern_detail(pattern_id: str, db: Session = Depends(get_db)):
    """Returns full pattern detail including evidence events, graph, timeline, and LLM explanation."""
    pattern = db.query(PatternModel).filter(PatternModel.pattern_id == pattern_id).first()
    if not pattern:
        raise HTTPException(status_code=404, detail=f"Pattern {pattern_id} not found")

    # Fetch evidence events near pattern center
    all_events = db.query(EventModel).filter(EventModel.period == "before").all()
    from pipeline import haversine_distance_meters
    matching_events = [
        e for e in all_events
        if haversine_distance_meters(pattern.center_lat, pattern.center_lon, e.lat, e.lon) <= max(pattern.radius_m, 60.0)
    ]

    event_schemas = [EventSchema.model_validate(e) for e in matching_events]

    status_log = (
        db.query(PatternStatusEventModel)
        .filter(PatternStatusEventModel.pattern_id == pattern_id)
        .order_by(PatternStatusEventModel.created_at.asc())
        .all()
    )

    return PatternDetailSchema(
        id=pattern.pattern_id,
        center=CenterCoordinates(lat=pattern.center_lat, lon=pattern.center_lon),
        radius_m=pattern.radius_m,
        score=pattern.score,
        score_breakdown=pattern.score_breakdown,
        time_window=pattern.time_window,
        days_observed=pattern.days_observed,
        event_count=pattern.event_count,
        independent_source_count=pattern.independent_source_count,
        top_categories=pattern.top_categories,
        events=event_schemas,
        source_distribution=pattern.source_distribution,
        graph=pattern.graph,
        timeline=pattern.timeline,
        observed_facts=pattern.observed_facts,
        candidate_explanations=pattern.candidate_explanations,
        recommended_investigation=pattern.recommended_investigation,
        disclaimer=pattern.disclaimer,
        is_synthetic=pattern.is_synthetic,
        assigned_department=pattern.assigned_department,
        assigned_zone=pattern.assigned_zone,
        status=pattern.status,
        status_note=pattern.status_note,
        acknowledge_due_at=pattern.acknowledge_due_at,
        resolve_due_at=pattern.resolve_due_at,
        acknowledged_at=pattern.acknowledged_at,
        resolved_at=pattern.resolved_at,
        is_overdue=governance.is_overdue(pattern),
        status_updated_at=pattern.status_updated_at,
        progress_percent=pattern.progress_percent,
        evidence_signals=pattern.evidence_signals or {},
        status_log=[StatusLogEntrySchema.model_validate(s) for s in status_log]
    )


@app.post("/api/patterns/{pattern_id}/refresh-evidence", response_model=PatternDetailSchema)
def refresh_pattern_evidence(pattern_id: str, db: Session = Depends(get_db)):
    """
    Re-fetches multi-source evidence for this pattern on demand — live NOAA
    weather plus fresh (still deterministic-per-call-time) simulated
    readings — without re-running the whole clustering pipeline. Useful in a
    demo to show the evidence panel isn't a static snapshot.
    """
    pattern = db.query(PatternModel).filter(PatternModel.pattern_id == pattern_id).first()
    if not pattern:
        raise HTTPException(status_code=404, detail=f"Pattern {pattern_id} not found")

    import evidence_sources
    from pipeline import haversine_distance_meters
    dominant_category = (pattern.top_categories or [None])[0]
    camera_count = sum(
        1 for e in db.query(EventModel).filter(EventModel.period == "before").all()
        if e.evidence_source_type == "cctv_camera"
        and haversine_distance_meters(pattern.center_lat, pattern.center_lon, e.lat, e.lon) <= max(pattern.radius_m, 60.0)
    )
    pattern.evidence_signals = evidence_sources.gather_evidence_for_pattern(
        pattern.center_lat, pattern.center_lon, pattern.assigned_zone, dominant_category,
        seed_key=f"{pattern_id}:refresh:{datetime.utcnow().isoformat()}",
        camera_event_count=camera_count
    )
    db.commit()
    return get_pattern_detail(pattern_id, db)


@app.patch("/api/patterns/{pattern_id}/status", response_model=PatternDetailSchema)
def update_pattern_status(
    pattern_id: str,
    req: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Government-side action: acknowledge, work on, resolve, or reject a detected
    pattern. Every call appends to the public audit trail (status_log) so
    citizens can see what happened and when — this is the transparency loop.
    """
    pattern = db.query(PatternModel).filter(PatternModel.pattern_id == pattern_id).first()
    if not pattern:
        raise HTTPException(status_code=404, detail=f"Pattern {pattern_id} not found")

    try:
        governance.apply_status_update(
            db, pattern,
            new_status=req.status,
            department=req.department,
            note=req.note,
            actor_label=req.actor_label,
            progress_percent=req.progress_percent
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    return get_pattern_detail(pattern_id, db)


@app.get("/api/transparency/summary", response_model=TransparencySummarySchema)
def get_transparency_summary(db: Session = Depends(get_db)):
    """
    Public accountability view: counts of open/resolved/overdue patterns and
    average resolution time, broken down by responsible department. No auth —
    this is meant to be visible to citizens and city leadership alike.
    """
    patterns = db.query(PatternModel).all()
    return governance.build_transparency_summary(patterns)


@app.get("/api/my-reports", response_model=List[MyReportItemSchema])
def get_my_reports(
    submitter_id: Optional[str] = Query(None, description="The submitter identifier used when reporting (omit if logged in)"),
    current_user: Optional[UserModel] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Citizen awareness loop: lets a citizen look up their own submitted
    observations and see whether they were absorbed into a detected pattern,
    who it's assigned to, and its current status/latest note. Logged-in users
    don't need to type anything — their phone number is used automatically;
    `submitter_id` remains available for anonymous/demo lookups.
    """
    if current_user:
        submitter_id = current_user.phone_number
    if not submitter_id:
        raise HTTPException(status_code=400, detail="Log in, or provide a submitter_id.")

    events = (
        db.query(EventModel)
        .filter(EventModel.submitter_id == submitter_id)
        .order_by(EventModel.timestamp.desc())
        .all()
    )
    if not events:
        return []

    all_before_events = db.query(EventModel).filter(EventModel.period == "before").all()
    patterns = db.query(PatternModel).all()

    from pipeline import haversine_distance_meters

    results = []
    for ev in events:
        matched_pattern = None
        if ev.period == "before":
            for p in patterns:
                if haversine_distance_meters(p.center_lat, p.center_lon, ev.lat, ev.lon) <= max(p.radius_m, 60.0):
                    matched_pattern = p
                    break

        ev_log = (
            db.query(EventStatusEventModel)
            .filter(EventStatusEventModel.event_id == ev.event_id)
            .order_by(EventStatusEventModel.created_at.asc())
            .all()
        )

        results.append(MyReportItemSchema(
            event=EventSchema.model_validate(ev),
            event_status_log=[StatusLogEntrySchema.model_validate(s) for s in ev_log],
            pattern_id=matched_pattern.pattern_id if matched_pattern else None,
            pattern_status=matched_pattern.status if matched_pattern else None,
            pattern_department=matched_pattern.assigned_department if matched_pattern else None,
            pattern_score=matched_pattern.score if matched_pattern else None,
            pattern_status_note=matched_pattern.status_note if matched_pattern else None,
            pattern_status_updated_at=matched_pattern.status_updated_at if matched_pattern else None
        ))

    return results


@app.get("/api/reports/inbox", response_model=List[EventSchema])
def get_reports_inbox(
    department: Optional[str] = Query(None, description="Filter to reports routed to this department"),
    zone: Optional[str] = Query(None, description="Filter to reports routed to this zone/ward"),
    status: Optional[str] = Query(None, description="Filter by status: new, acknowledged, in_progress, resolved, rejected"),
    period: str = Query("before", description="'before' (default, live reports) or 'after'"),
    db: Session = Depends(get_db)
):
    """
    The government-side inbox: every individual report, auto-routed to its
    department and zone the moment it was submitted — independent of whether
    it ever becomes part of a detected pattern. This is what makes routing
    immediate rather than something that only happens after AI clustering.
    """
    query = db.query(EventModel).filter(EventModel.period == period)
    if department:
        query = query.filter(EventModel.assigned_department == department)
    if zone:
        query = query.filter(EventModel.assigned_zone == zone)
    if status:
        query = query.filter(EventModel.status == status)
    return query.order_by(EventModel.status_updated_at.desc()).all()


@app.get("/api/observations/{event_id}/status-log", response_model=List[StatusLogEntrySchema])
def get_event_status_log(event_id: str, db: Session = Depends(get_db)):
    """Public audit trail for a single individual report."""
    log = (
        db.query(EventStatusEventModel)
        .filter(EventStatusEventModel.event_id == event_id)
        .order_by(EventStatusEventModel.created_at.asc())
        .all()
    )
    return log


@app.patch("/api/observations/{event_id}/status", response_model=EventSchema)
def update_event_status(
    event_id: str,
    req: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Government-side action on a single individual report (not just a
    detected pattern) — e.g. acting on one serious report that hasn't
    (yet) joined a multi-source pattern. Logs to the same public audit
    trail model as pattern updates.
    """
    event = db.query(EventModel).filter(EventModel.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

    try:
        governance.apply_event_status_update(
            db, event,
            new_status=req.status,
            department=req.department,
            note=req.note,
            actor_label=req.actor_label,
            progress_percent=req.progress_percent
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Earn Points: the first time an officer acknowledges/resolves this
    # report's event, credit the reporter's "confirmed by authority" points.
    points_module.maybe_confirm_authority_for_event(db, event)

    db.commit()
    db.refresh(event)
    return event


# --- Predictive risk escalation ---

@app.post("/api/escalations/scan", response_model=List[EscalationSchema])
def run_escalation_scan(db: Session = Depends(get_db)):
    """
    Manually triggers a risk scan (also run automatically after every
    `/api/analyze`). Checks every open, overdue case in a weather-sensitive
    category against the forecast for its zone and files a new escalation
    for anything newly at risk. Safe to call anytime — degrades to "no new
    escalations" if the weather API is unreachable.
    """
    try:
        created = risk_escalation.scan_for_escalations(db)
    except Exception as e:
        logger.warning(f"Risk escalation scan failed: {e}")
        raise HTTPException(status_code=502, detail="Weather risk check failed. Try again shortly.")
    return created


@app.get("/api/escalations", response_model=List[EscalationSchema])
def list_escalations(
    department: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """Lists risk escalations — the 'notification to the responsible government committee'."""
    query = db.query(EscalationModel)
    if department:
        query = query.filter(EscalationModel.department == department)
    if zone:
        query = query.filter(EscalationModel.zone == zone)
    if acknowledged is not None:
        query = query.filter(EscalationModel.acknowledged == acknowledged)
    return query.order_by(EscalationModel.created_at.desc()).all()


@app.patch("/api/escalations/{escalation_id}/acknowledge", response_model=EscalationSchema)
def acknowledge_escalation(
    escalation_id: str,
    req: AcknowledgeEscalationRequest,
    db: Session = Depends(get_db)
):
    """The department confirms it has seen and is acting on a risk escalation."""
    esc = db.query(EscalationModel).filter(EscalationModel.id == escalation_id).first()
    if not esc:
        raise HTTPException(status_code=404, detail=f"Escalation {escalation_id} not found")
    esc.acknowledged = True
    esc.acknowledged_at = datetime.utcnow()
    esc.acknowledged_by = req.actor_label or "City Authority"
    db.commit()
    db.refresh(esc)
    return esc


@app.post("/api/interventions/simulate", response_model=InterventionsSimulateResponse)
def simulate_intervention_endpoint(
    req: InterventionsSimulateRequest,
    db: Session = Depends(get_db)
):
    """Simulates post-intervention 'after' events and returns before/after reduction stats."""
    try:
        res = simulate_intervention(db, req.pattern_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --- Earn Points / Community Rewards ---

@app.get("/api/points/summary", response_model=PointsSummarySchema)
def get_my_points_summary(
    user: UserModel = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """Totals, level, and progress toward the next level for the logged-in user."""
    return points_module.get_points_summary(db, user.user_id)


@app.get("/api/rewards", response_model=List[RewardSchema])
def list_rewards():
    """The static reward catalog — no auth needed, anyone can browse what's redeemable."""
    return REWARD_CATALOG


@app.post("/api/rewards/redeem", response_model=RedemptionSchema)
def redeem_reward_endpoint(
    req: RedeemRewardRequest,
    user: UserModel = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """Spends points from the user's balance on a reward. Fails if the balance is insufficient."""
    try:
        redemption = points_module.redeem_reward(db, user.user_id, req.reward_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    db.refresh(redemption)
    return redemption


@app.get("/api/rewards/redeemed", response_model=List[RedemptionSchema])
def get_my_redemptions(
    user: UserModel = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """The logged-in user's redemption history."""
    return points_module.list_redemptions(db, user.user_id)


@app.get("/api/reports/verifiable", response_model=List[VerifiableReportSchema])
def get_verifiable_reports_endpoint(
    user: Optional[UserModel] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Other citizens' recent reports available for community verification (excludes your own)."""
    return points_module.get_verifiable_reports(db, exclude_user_id=user.user_id if user else None)


@app.post("/api/reports/{report_id}/verify", response_model=PointsSummarySchema)
def verify_report_endpoint(
    report_id: str,
    user: UserModel = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """
    Confirms someone else's report is real ("I can confirm this too"),
    crediting its original reporter +10 points once. Returns the *verifier's*
    own points summary (verifying doesn't earn the verifier anything — it
    credits the reporter — but it's a convenient refresh point for the UI).
    """
    try:
        points_module.verify_report(db, report_id, user.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return points_module.get_points_summary(db, user.user_id)


@app.post("/api/reports/{report_id}/followup", response_model=PointsSummarySchema)
def submit_followup_endpoint(
    report_id: str,
    req: FollowupRequest,
    user: UserModel = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    """Owner adds a follow-up update; earns +10 once, only if the report is >=7 days old and the text is meaningful."""
    try:
        points_module.submit_followup(db, report_id, user.user_id, req.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return points_module.get_points_summary(db, user.user_id)


@app.get("/api/community-partners", response_model=List[CommunityPartnerSchema])
def get_community_partners():
    """Illustrative example partners for the 'Community Partners' section."""
    return COMMUNITY_PARTNERS


# --- Serve the built frontend (single-origin deployment) ---
# Mounted last, after every /api/* route above, so it only ever catches
# requests that don't match an API route. Run `npm run build` in frontend/
# first; if the build is missing we skip this instead of crashing, so the
# API still works standalone (e.g. while developing the frontend with
# `npm run dev`, which proxies to this server instead).
FRONTEND_DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
    logger.info(f"Serving built frontend from {FRONTEND_DIST_DIR}")
else:
    logger.warning(
        f"No frontend build found at {FRONTEND_DIST_DIR} — API-only mode. "
        f"Run 'npm run build' in frontend/ to serve the full site from this server."
    )
