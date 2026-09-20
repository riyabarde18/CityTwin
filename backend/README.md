# CityTwin Backend MVP

CityTwin is an urban intelligence backend engine built with Python 3.11, FastAPI, SQLite (SQLAlchemy), scikit-learn, pandas, and the Google Gemini API (`google-genai` SDK).

It ingests unstructured citizen observations (photo + text + GPS + time), extracts urban problem events via AI vision/text perception, and uses spatial-temporal clustering (DBSCAN), category co-occurrence lift analysis, rule-based causal prior graphs, and explainable AI scoring to detect emerging multi-hazard urban patterns.

---

## Key Features

1. **Perception Engine (`perception.py`)**:
   - Classifies reports into a fixed list of 8 urban problem categories:
     `standing_water`, `footpath_obstruction`, `pedestrian_on_road`, `traffic_slowdown`, `damaged_surface`, `garbage`, `unsafe_crossing`, `accessibility_barrier`.
   - Uses `google-genai` SDK with JSON schema mode.
   - Includes automatic **MOCK perception fallback** (keyword matching & heuristic classification) if `GEMINI_API_KEY` is missing or unconfigured.

2. **Analysis Pipeline (`pipeline.py`)**:
   - **Spatial**: DBSCAN haversine metric (`eps=60m`, `min_samples=4`).
   - **Temporal**: Peak 2-hour window binning and multi-day recurrence tracking.
   - **Lift Analysis**: Category co-occurrence vs. citywide baseline share (`lift > 1.5`).
   - **Explainable Scoring**: 0-100 weighted score breakdown (independent evidence, spatial tightness, temporal recurrence, category co-occurrence, confidence, deduplication penalty).
   - **Strict Filtering**: Enforces `score >= 50`, `distinct_categories >= 3`, and `independent_submitters >= 4` (ignores single-category clusters like garbage decoys).
   - **Causal Prior Graph**: Directed rules (`standing_water -> footpath_obstruction -> pedestrian_on_road -> traffic_slowdown`, etc.).
   - **LLM Synthesis**: Hypotheses generation and field verification recommendations.

3. **Synthetic Demo Seeding (`seed.py`)**:
   - `/api/seed` generates 1 Hotspot (~16 multi-category events), 1 Decoy (6 garbage events), and ~40 scattered noise events around configurable city center coordinates.

4. **Intervention Simulator (`simulator.py`)**:
   - `/api/interventions/simulate` generates post-fix "after" reports with reduced problem counts (~75-85% reduction) and computes before/after comparison stats.

---

## Requirements & Setup

### Prerequisites
- Python 3.11+
- Virtual environment (recommended)

### Environment Variables
Create a `.env` file inside `/backend` (or set env variables):
```env
GEMINI_API_KEY=PASTE_KEY_HERE
CITY_CENTER_LAT=37.7749
CITY_CENTER_LON=-122.4194
```
*If `GEMINI_API_KEY` is set to `PASTE_KEY_HERE` or omitted, the app runs in **MOCK mode**.*

### Installation
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
```

### Running the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The server will start at `http://localhost:8000`. OpenAPI interactive docs will be available at `http://localhost:8000/docs`.

### Serving the full website from this one server (recommended)
If `frontend/dist` exists (i.e. you've run `npm run build` in `frontend/`), this server
automatically mounts it and serves the whole app — UI and API — from `http://localhost:8000`.
No separate frontend process needed. See the root [README.md](../README.md) for the one-command version.

---

## Pattern Scoring Breakdown (0 - 100)

The pattern score is an explainable weighted sum of five key signal components minus a deduplication/noise penalty:

| Component | Max Points | Description |
| :--- | :---: | :--- |
| **Independent Evidence** | 25.0 | Distinct submitter count (scaled up to 10 distinct submitters). |
| **Spatial Consistency** | 20.0 | Cluster tightness (average distance in meters from centroid). |
| **Temporal Recurrence** | 20.0 | Share of events in peak 2-hour window + distinct days observed count. |
| **Category Co-occurrence** | 25.0 | Number of categories with lift > 1.5 + bonus if they form a causal chain. |
| **Detection Confidence** | 10.0 | Average AI perception confidence score. |
| **Duplication Penalty** | -20.0 | Penalty for rapid submitter repetitions or identical image hashes. |

---

## API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & MOCK status mode indicator |
| `POST` | `/api/observations` | Ingest observation (multipart form: image, text, lat, lon, submitter_id); returns `{events, points_awarded, is_spam, spam_reason}` |
| `GET` | `/api/events?period=before\|after` | Retrieve all stored events |
| `POST` | `/api/seed` | Reset DB and load synthetic demo dataset |
| `POST` | `/api/analyze` | Run 7-step analysis pipeline and generate patterns |
| `GET` | `/api/patterns` | List detected pattern summaries |
| `GET` | `/api/patterns/{id}` | Retrieve full pattern detail (evidence events, graph, timeline, LLM synthesis, status log) |
| `POST` | `/api/interventions/simulate` | Simulate post-intervention "after" period and get reduction metrics |
| `PATCH` | `/api/patterns/{id}/status` | Government-side action: acknowledge / progress / resolve / reject a pattern, optionally with `progress_percent` (logs to public audit trail) |
| `GET` | `/api/transparency/summary` | Public, no-auth accountability view: counts + avg resolution time by department |
| `GET` | `/api/my-reports?submitter_id=` | Citizen looks up their own submitted reports (or omit the param when logged in) |
| `GET` | `/api/reports/inbox?department=&zone=&status=` | Department-side inbox: every individually-routed report, filterable |
| `GET` | `/api/observations/{id}/status-log` | Public audit trail for a single individual report |
| `PATCH` | `/api/observations/{id}/status` | Government-side action on a single report (not just a pattern) |
| `POST` | `/api/auth/request-otp` | Issues a one-time code for a phone number (dev-mode: also returned in the response) |
| `POST` | `/api/auth/verify-otp` | Verifies the code; creates the account on first login; returns a session token |
| `GET` | `/api/auth/me` | Returns the currently authenticated user (`Authorization: Bearer <token>`) |
| `POST` | `/api/escalations/scan` | Runs the predictive risk scan now; returns newly created escalations |
| `GET` | `/api/escalations?department=&zone=&acknowledged=` | Lists risk escalations (the "notification" surface) |
| `PATCH` | `/api/escalations/{id}/acknowledge` | Department confirms it has seen and is acting on an escalation |
| `GET` | `/api/points/summary` | Logged-in user's points totals, level, and progress to next level |
| `GET` | `/api/rewards` | The static reward catalog (public) |
| `POST` | `/api/rewards/redeem` | Spend points on a reward (`{reward_id}`) |
| `GET` | `/api/rewards/redeemed` | Logged-in user's redemption history |
| `GET` | `/api/reports/verifiable` | Other citizens' reports available for community verification |
| `POST` | `/api/reports/{id}/verify` | Confirm someone else's report is real; credits its reporter +10 once |
| `POST` | `/api/reports/{id}/followup` | Owner adds a follow-up update; +10 once, only if the report is ≥7 days old |
| `GET` | `/api/community-partners` | Illustrative example partners for the rewards program |

---

## Earn Points / Community Rewards (`points.py`)

Every citizen submission creates a `ReportModel` (one submission, even if AI perception splits it into several category events), and points are evaluated **per report**, not per resulting event. Four awards happen at submission time — report (+10), photo evidence (+5), meaningful text ≥15 chars (+5), and an accurate location that isn't just the untouched map-center default (+5) — plus three post-submission awards: another citizen verifying the report (+10, once, and not by the reporter themselves), an officer acknowledging/resolving its event for the first time (+25, hooked into the existing governance status-update endpoint), and a meaningful follow-up ≥7 days later (+10, once).

**"Only once" is a data guarantee, not a promise**: every award writes one row to the append-only `points_ledger` keyed by `(user_id, report_id, action_type)`; the award function checks for an existing row with that exact key before writing, so re-triggering the same action is a no-op.

**Anti-abuse**: a report is flagged as spam (no points, but still recorded) if its photo hash exactly matches one already on file, or if the same user has filed more than `SPAM_RATE_LIMIT_MAX_REPORTS` reports within `SPAM_RATE_LIMIT_WINDOW_MINUTES`.

**Levels** (`CONTRIBUTION_LEVELS` in `config.py`) are based on *lifetime points earned*, never current balance — redeeming a reward can't demote you. Thresholds: 100 → Bronze Citizen, 200 → Silver Citizen, 300 → Gold Citizen, 400 → City Champion. The reward catalog and example community partners are also static config, ready to swap for a real onboarded-partner database.

---

## Government Accountability & Transparency Layer (`governance.py`)

Every detected pattern is auto-routed to the municipal department that owns its dominant
category (`config.CATEGORY_TO_DEPARTMENT`), given SLA due dates (`SLA_DAYS_TO_ACKNOWLEDGE`,
`SLA_DAYS_TO_RESOLVE`), and tracked through a small status lifecycle:
`new → acknowledged → in_progress → resolved` (or `rejected`, with re-opening allowed).
Every transition is appended to `pattern_status_events` — an immutable audit trail returned
in `status_log` on `/api/patterns/{id}` and aggregated (citywide + per-department) in
`/api/transparency/summary`. This is a demo-console stand-in for an authenticated department
portal — there's no login/auth on the status-update endpoint yet.

---

## Disclaimer
> Hypothesis for investigation; verification by the city authority required.
