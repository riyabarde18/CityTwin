export type UrbanCategory =
  | 'standing_water'
  | 'footpath_obstruction'
  | 'pedestrian_on_road'
  | 'traffic_slowdown'
  | 'damaged_surface'
  | 'garbage'
  | 'unsafe_crossing'
  | 'accessibility_barrier';

export type PatternStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected';

export interface EventItem {
  event_id: string;
  submitter_id: string;
  lat: number;
  lon: number;
  road_segment_id?: string | null;
  timestamp: string;
  category: UrbanCategory;
  severity: number;
  detected_objects: string[];
  description: string;
  evidence_type: string;
  image_path?: string | null;
  confidence: number;
  is_synthetic: boolean;
  period: 'before' | 'after';
  // Auto-routing: set the instant the report is created, independent of
  // whether it ever becomes part of a detected pattern.
  assigned_department: string;
  assigned_zone: string;
  status: PatternStatus;
  status_note?: string | null;
  acknowledge_due_at?: string | null;
  resolve_due_at?: string | null;
  status_updated_at?: string | null;
  progress_percent: number;
  evidence_source_type: 'citizen_report' | 'cctv_camera';
}

export interface CenterCoordinates {
  lat: number;
  lon: number;
}

export interface PatternSummary {
  id: string;
  center: CenterCoordinates;
  score: number;
  top_categories: UrbanCategory[];
  time_window: string;
  event_count: number;
  independent_source_count: number;
  confidence: number;
  is_synthetic: boolean;
  assigned_department: string;
  assigned_zone: string;
  status: PatternStatus;
  acknowledge_due_at?: string | null;
  resolve_due_at?: string | null;
  is_overdue: boolean;
  status_updated_at?: string | null;
  progress_percent: number;
}

export interface GraphNode {
  id: string;
  category: UrbanCategory;
  count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface PatternGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CandidateExplanation {
  explanation: string;
  confidence: number;
  supporting_categories: UrbanCategory[];
  supporting_evidence_sources?: string[];
}

export interface ScoreBreakdown {
  independent_evidence: number;
  spatial_consistency: number;
  temporal_recurrence: number;
  category_cooccurrence: number;
  detection_confidence: number;
  cross_source_corroboration?: number;
  duplication_penalty: number;
  [key: string]: number | undefined;
}

// --- Multi-source root-cause evidence ---

export type EvidenceSourceType = 'noaa_weather' | 'satellite' | 'mobility_gps' | 'public_transit' | 'cctv_camera';

export interface EvidenceSignal {
  source_type: EvidenceSourceType;
  available: boolean;
  relevant: boolean;
  is_simulated: boolean;
  supports?: boolean | null;
  summary: Record<string, any>;
  interpretation: string;
}

export interface StatusLogEntry {
  id: string;
  status: PatternStatus;
  department: string;
  zone?: string | null;
  note?: string | null;
  actor_label: string;
  created_at: string;
}

export interface PatternDetail {
  id: string;
  center: CenterCoordinates;
  radius_m: number;
  score: number;
  score_breakdown: ScoreBreakdown;
  time_window: string;
  days_observed: number;
  event_count: number;
  independent_source_count: number;
  top_categories: UrbanCategory[];
  confidence: number;
  events: EventItem[];
  source_distribution: Record<string, number>;
  graph: PatternGraph;
  timeline: Record<string, number>;
  observed_facts: string[];
  candidate_explanations: CandidateExplanation[];
  recommended_investigation: string[];
  disclaimer: string;
  is_synthetic: boolean;
  assigned_department: string;
  assigned_zone: string;
  status: PatternStatus;
  status_note?: string | null;
  acknowledge_due_at?: string | null;
  resolve_due_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  is_overdue: boolean;
  status_updated_at?: string | null;
  progress_percent: number;
  evidence_signals: Partial<Record<EvidenceSourceType, EvidenceSignal>>;
  status_log: StatusLogEntry[];
}

export interface MyReportItem {
  event: EventItem;
  event_status_log: StatusLogEntry[];
  pattern_id?: string | null;
  pattern_status?: PatternStatus | null;
  pattern_department?: string | null;
  pattern_score?: number | null;
  pattern_status_note?: string | null;
  pattern_status_updated_at?: string | null;
}

export interface TransparencyDepartmentStat {
  department: string;
  total: number;
  new: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  overdue: number;
  avg_resolution_days?: number | null;
}

export interface TransparencySummary {
  total_patterns: number;
  total_resolved: number;
  total_overdue: number;
  citywide_avg_resolution_days?: number | null;
  by_department: TransparencyDepartmentStat[];
}

export interface CategoryComparison {
  category: UrbanCategory;
  before_count: number;
  after_count: number;
  reduction_pct: number;
}

export interface WeeklyComparison {
  week_label: string;
  before_count: number;
  after_count: number;
}

export interface InterventionResult {
  pattern_id: string;
  before_total_events: number;
  after_total_events: number;
  overall_reduction_pct: number;
  category_comparison: CategoryComparison[];
  weekly_timeline: WeeklyComparison[];
  generated_after_events: EventItem[];
  is_synthetic: boolean;
}

export interface HealthStatus {
  status: string;
  mock_mode: boolean;
}

// --- Phone-based accounts ---

export interface User {
  user_id: string;
  phone_number: string;
  display_name?: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RequestOtpResponse {
  phone_number: string;
  expires_in_minutes: number;
  dev_otp?: string | null;
}

// --- Predictive risk escalation ---

export type RiskLevel = 'elevated' | 'severe';

export interface Escalation {
  id: string;
  case_type: 'pattern' | 'event';
  case_id: string;
  department: string;
  zone: string;
  category: UrbanCategory;
  risk_level: RiskLevel;
  reason: string;
  weather_summary?: {
    risk_level: RiskLevel;
    precipitation_probability_max_pct: number;
    precipitation_sum_mm: number;
    forecast_days: number;
    source: string;
  } | null;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
}
