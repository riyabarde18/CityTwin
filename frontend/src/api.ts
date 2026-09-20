import axios from 'axios';
import {
  HealthStatus,
  EventItem,
  PatternSummary,
  PatternDetail,
  InterventionResult,
  MyReportItem,
  TransparencySummary,
  PatternStatus,
  StatusLogEntry,
  User,
  AuthResponse,
  RequestOtpResponse,
  Escalation,
  ObservationSubmitResult,
  PointsSummary,
  Reward,
  Redemption,
  VerifiableReport,
  CommunityPartner
} from './types';

// Empty string = same-origin relative requests. This works in three setups:
//  1. Unified deploy: FastAPI serves the built frontend + API from one port.
//  2. `vite dev`: the dev server proxies /api and /uploads to localhost:8000 (see vite.config.ts).
//  3. Split hosting: set VITE_API_BASE_URL to point at a separately hosted backend.
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// --- Session token: attached to every request automatically once logged in ---
const TOKEN_KEY = 'citytwin_auth_token';
const USER_KEY = 'citytwin_auth_user';

export const getStoredToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const storeSession = (token: string, user: User) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* private browsing / storage blocked — session just won't persist across reloads */ }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const getHealth = async (): Promise<HealthStatus> => {
  const res = await api.get<HealthStatus>('/api/health');
  return res.data;
};

export const getEvents = async (period?: 'before' | 'after'): Promise<EventItem[]> => {
  const res = await api.get<EventItem[]>('/api/events', {
    params: period ? { period } : {}
  });
  return res.data;
};

export const postObservation = async (formData: FormData): Promise<ObservationSubmitResult> => {
  const res = await api.post<ObservationSubmitResult>('/api/observations', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const seedDatabase = async (): Promise<{ status: string; events_created: number }> => {
  const res = await api.post('/api/seed');
  return res.data;
};

export const analyzePatterns = async (): Promise<PatternSummary[]> => {
  const res = await api.post<PatternSummary[]>('/api/analyze');
  return res.data;
};

export const getPatterns = async (): Promise<PatternSummary[]> => {
  const res = await api.get<PatternSummary[]>('/api/patterns');
  return res.data;
};

export const getPatternDetail = async (id: string): Promise<PatternDetail> => {
  const res = await api.get<PatternDetail>(`/api/patterns/${id}`);
  return res.data;
};

export const refreshPatternEvidence = async (id: string): Promise<PatternDetail> => {
  const res = await api.post<PatternDetail>(`/api/patterns/${id}/refresh-evidence`);
  return res.data;
};

// --- Multi-source evidence: CCTV camera feeds (real Gemini vision) ---

export const ingestCameraFeed = async (formData: FormData): Promise<EventItem[]> => {
  const res = await api.post<EventItem[]>('/api/camera-feeds/ingest', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getCameraFeeds = async (): Promise<EventItem[]> => {
  const res = await api.get<EventItem[]>('/api/camera-feeds');
  return res.data;
};

export const simulateIntervention = async (patternId: string): Promise<InterventionResult> => {
  const res = await api.post<InterventionResult>('/api/interventions/simulate', {
    pattern_id: patternId,
  });
  return res.data;
};

// --- Phone-based accounts ---

export const requestOtp = async (phoneNumber: string): Promise<RequestOtpResponse> => {
  const res = await api.post<RequestOtpResponse>('/api/auth/request-otp', { phone_number: phoneNumber });
  return res.data;
};

export const verifyOtp = async (phoneNumber: string, otp: string): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/api/auth/verify-otp', { phone_number: phoneNumber, otp });
  storeSession(res.data.token, res.data.user);
  return res.data;
};

export const getMe = async (): Promise<User> => {
  const res = await api.get<User>('/api/auth/me');
  return res.data;
};

export const logout = () => {
  clearSession();
};

// --- Government accountability & transparency layer ---

export const updatePatternStatus = async (
  patternId: string,
  status: PatternStatus,
  opts?: { department?: string; note?: string; actorLabel?: string; progressPercent?: number }
): Promise<PatternDetail> => {
  const res = await api.patch<PatternDetail>(`/api/patterns/${patternId}/status`, {
    status,
    department: opts?.department,
    note: opts?.note,
    actor_label: opts?.actorLabel,
    progress_percent: opts?.progressPercent,
  });
  return res.data;
};

export const getTransparencySummary = async (): Promise<TransparencySummary> => {
  const res = await api.get<TransparencySummary>('/api/transparency/summary');
  return res.data;
};

export const getMyReports = async (submitterId?: string): Promise<MyReportItem[]> => {
  // Omit submitter_id entirely when logged in — the backend resolves the
  // caller from the Bearer token (attached automatically, see interceptor
  // above) and ignores/ doesn't require the query param in that case.
  const res = await api.get<MyReportItem[]>('/api/my-reports', {
    params: submitterId ? { submitter_id: submitterId } : {},
  });
  return res.data;
};

// --- Automatic per-report routing (individual reports, not just detected patterns) ---

export interface ReportsInboxFilters {
  department?: string;
  zone?: string;
  status?: PatternStatus;
  period?: 'before' | 'after';
}

export const getReportsInbox = async (filters?: ReportsInboxFilters): Promise<EventItem[]> => {
  const res = await api.get<EventItem[]>('/api/reports/inbox', { params: filters || {} });
  return res.data;
};

export const getEventStatusLog = async (eventId: string): Promise<StatusLogEntry[]> => {
  const res = await api.get<StatusLogEntry[]>(`/api/observations/${eventId}/status-log`);
  return res.data;
};

export const updateEventStatus = async (
  eventId: string,
  status: PatternStatus,
  opts?: { department?: string; note?: string; actorLabel?: string; progressPercent?: number }
): Promise<EventItem> => {
  const res = await api.patch<EventItem>(`/api/observations/${eventId}/status`, {
    status,
    department: opts?.department,
    note: opts?.note,
    actor_label: opts?.actorLabel,
    progress_percent: opts?.progressPercent,
  });
  return res.data;
};

// --- Predictive risk escalation ---

export const scanEscalations = async (): Promise<Escalation[]> => {
  const res = await api.post<Escalation[]>('/api/escalations/scan');
  return res.data;
};

export interface EscalationFilters {
  department?: string;
  zone?: string;
  acknowledged?: boolean;
}

export const getEscalations = async (filters?: EscalationFilters): Promise<Escalation[]> => {
  const res = await api.get<Escalation[]>('/api/escalations', { params: filters || {} });
  return res.data;
};

export const acknowledgeEscalation = async (id: string, actorLabel?: string): Promise<Escalation> => {
  const res = await api.patch<Escalation>(`/api/escalations/${id}/acknowledge`, { actor_label: actorLabel });
  return res.data;
};

// --- Earn Points / Community Rewards ---

export const getPointsSummary = async (): Promise<PointsSummary> => {
  const res = await api.get<PointsSummary>('/api/points/summary');
  return res.data;
};

export const getRewards = async (): Promise<Reward[]> => {
  const res = await api.get<Reward[]>('/api/rewards');
  return res.data;
};

export const redeemReward = async (rewardId: string): Promise<Redemption> => {
  const res = await api.post<Redemption>('/api/rewards/redeem', { reward_id: rewardId });
  return res.data;
};

export const getMyRedemptions = async (): Promise<Redemption[]> => {
  const res = await api.get<Redemption[]>('/api/rewards/redeemed');
  return res.data;
};

export const getVerifiableReports = async (): Promise<VerifiableReport[]> => {
  const res = await api.get<VerifiableReport[]>('/api/reports/verifiable');
  return res.data;
};

export const verifyReport = async (reportId: string): Promise<PointsSummary> => {
  const res = await api.post<PointsSummary>(`/api/reports/${reportId}/verify`);
  return res.data;
};

export const submitFollowup = async (reportId: string, text: string): Promise<PointsSummary> => {
  const res = await api.post<PointsSummary>(`/api/reports/${reportId}/followup`, { text });
  return res.data;
};

export const getCommunityPartners = async (): Promise<CommunityPartner[]> => {
  const res = await api.get<CommunityPartner[]>('/api/community-partners');
  return res.data;
};

export default api;
