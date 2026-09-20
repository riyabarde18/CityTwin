from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class HealthResponse(BaseModel):
    status: str
    mock_mode: bool

class EventSchema(BaseModel):
    event_id: str
    submitter_id: str
    lat: float
    lon: float
    road_segment_id: Optional[str] = None
    timestamp: datetime
    category: str
    severity: int
    detected_objects: List[str]
    description: str
    evidence_type: str
    image_path: Optional[str] = None
    confidence: float
    is_synthetic: bool
    period: str
    evidence_source_type: str = "citizen_report"

    # --- Automatic routing: set the instant the report is created ---
    assigned_department: str = "Municipal Operations (General)"
    assigned_zone: str = "Unzoned / Citywide"
    status: str = "new"
    status_note: Optional[str] = None
    acknowledge_due_at: Optional[datetime] = None
    resolve_due_at: Optional[datetime] = None
    status_updated_at: Optional[datetime] = None
    progress_percent: int = 0

    class Config:
        from_attributes = True

class CenterCoordinates(BaseModel):
    lat: float
    lon: float

class GraphNode(BaseModel):
    id: str
    category: str
    count: int

class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float

class PatternGraph(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class CandidateExplanation(BaseModel):
    explanation: str
    confidence: float
    supporting_categories: List[str]
    supporting_evidence_sources: List[str] = []

class EvidenceSignalSchema(BaseModel):
    source_type: str
    available: bool
    relevant: bool
    is_simulated: bool
    supports: Optional[bool] = None
    summary: Dict[str, Any] = {}
    interpretation: str = ""

class StatusLogEntrySchema(BaseModel):
    id: str
    status: str
    department: str
    zone: Optional[str] = None
    note: Optional[str] = None
    actor_label: str
    created_at: datetime

    class Config:
        from_attributes = True

class PatternSummarySchema(BaseModel):
    id: str
    center: CenterCoordinates
    score: float
    top_categories: List[str]
    time_window: str
    event_count: int
    independent_source_count: int
    confidence: float
    is_synthetic: bool = True
    assigned_department: str = "Municipal Operations (General)"
    assigned_zone: str = "Unzoned / Citywide"
    status: str = "new"
    acknowledge_due_at: Optional[datetime] = None
    resolve_due_at: Optional[datetime] = None
    is_overdue: bool = False
    status_updated_at: Optional[datetime] = None
    progress_percent: int = 0

class PatternDetailSchema(BaseModel):
    id: str
    center: CenterCoordinates
    radius_m: float
    score: float
    score_breakdown: Dict[str, float]
    time_window: str
    days_observed: int
    event_count: int
    independent_source_count: int
    top_categories: List[str]
    events: List[EventSchema]
    source_distribution: Dict[str, int]
    graph: PatternGraph
    timeline: Dict[str, int]
    observed_facts: List[str]
    candidate_explanations: List[CandidateExplanation]
    recommended_investigation: List[str]
    disclaimer: str
    is_synthetic: bool = True
    assigned_department: str = "Municipal Operations (General)"
    assigned_zone: str = "Unzoned / Citywide"
    status: str = "new"
    status_note: Optional[str] = None
    acknowledge_due_at: Optional[datetime] = None
    resolve_due_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    is_overdue: bool = False
    status_updated_at: Optional[datetime] = None
    progress_percent: int = 0
    evidence_signals: Dict[str, EvidenceSignalSchema] = {}
    status_log: List[StatusLogEntrySchema] = []

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="One of: new, acknowledged, in_progress, resolved, rejected")
    department: Optional[str] = Field(None, description="Override the auto-assigned responsible department")
    note: Optional[str] = Field(None, description="Public-facing note explaining the update")
    actor_label: Optional[str] = Field(None, description="Name/role of the person making the update, e.g. 'PWD Ward 7 Officer'")
    progress_percent: Optional[int] = Field(None, ge=0, le=100, description="Optional explicit completion percent; otherwise a default for the new status is used")

class MyReportItemSchema(BaseModel):
    event: EventSchema
    event_status_log: List[StatusLogEntrySchema] = []
    pattern_id: Optional[str] = None
    pattern_status: Optional[str] = None
    pattern_department: Optional[str] = None
    pattern_score: Optional[float] = None
    pattern_status_note: Optional[str] = None
    pattern_status_updated_at: Optional[datetime] = None

class TransparencyDepartmentStat(BaseModel):
    department: str
    total: int
    new: int
    acknowledged: int
    in_progress: int
    resolved: int
    rejected: int
    overdue: int
    avg_resolution_days: Optional[float] = None

class TransparencySummarySchema(BaseModel):
    total_patterns: int
    total_resolved: int
    total_overdue: int
    citywide_avg_resolution_days: Optional[float] = None
    by_department: List[TransparencyDepartmentStat]

class InterventionsSimulateRequest(BaseModel):
    pattern_id: str

class CategoryComparison(BaseModel):
    category: str
    before_count: int
    after_count: int
    reduction_pct: float

class WeeklyComparison(BaseModel):
    week_label: str
    before_count: int
    after_count: int

class InterventionsSimulateResponse(BaseModel):
    pattern_id: str
    before_total_events: int
    after_total_events: int
    overall_reduction_pct: float
    category_comparison: List[CategoryComparison]
    weekly_timeline: List[WeeklyComparison]
    generated_after_events: List[EventSchema]
    is_synthetic: bool = True

# --- Phone-based accounts ---

class UserSchema(BaseModel):
    user_id: str
    phone_number: str
    display_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RequestOtpSchema(BaseModel):
    phone_number: str = Field(..., description="7-15 digits, optional leading +")

class RequestOtpResponse(BaseModel):
    phone_number: str
    expires_in_minutes: int
    dev_otp: Optional[str] = Field(
        None, description="Only populated in dev mode (no SMS gateway configured) — never sent in production."
    )

class VerifyOtpSchema(BaseModel):
    phone_number: str
    otp: str

class AuthResponse(BaseModel):
    token: str
    user: UserSchema

# --- Predictive risk escalation ---

class EscalationSchema(BaseModel):
    id: str
    case_type: str
    case_id: str
    department: str
    zone: str
    category: str
    risk_level: str
    reason: str
    weather_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    class Config:
        from_attributes = True

class AcknowledgeEscalationRequest(BaseModel):
    actor_label: Optional[str] = Field(None, description="Name/role of the person acknowledging, e.g. 'PWD Ward 7 Officer'")
