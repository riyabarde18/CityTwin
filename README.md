# CityTwin

AI-powered emergent urban problem detection — turns isolated citizen observations into
connected urban intelligence, routes detected patterns to the responsible municipal
department, and tracks response to resolution in public view.

- [`backend/README.md`](backend/README.md) — API, analysis pipeline, governance layer
- [`frontend/README.md`](frontend/README.md) — dashboard, reporting UI, dev workflow

## Run it as one website (recommended)

This builds the React dashboard once and lets the FastAPI backend serve both the UI and
the API from a single port — no separate frontend process, no CORS to think about.

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Manual / any OS:**
```bash
cd frontend && npm install && npm run build
cd ../backend && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000**.

First time in the UI: click **"Load demo data"**, then **"Run CityTwin analysis"** to see a
detected pattern hotspot, its causal graph, and its routed government department.

## Active development (hot reload)

Run the backend and frontend separately — Vite's dev server proxies API calls to the backend:
```bash
# terminal 1
cd backend && uvicorn main:app --reload --port 8000

# terminal 2
cd frontend && npm run dev
```
Open **http://localhost:5173**. After changing frontend code for a demo, re-run
`npm run build` (or `.\start.ps1`) so the unified server at :8000 picks up the change.

## What's here

- **Perception**: photo/text → structured urban events (Gemini, with a mock fallback).
- **Pipeline**: spatial (DBSCAN) + temporal clustering, category co-occurrence lift,
  explainable 0–100 pattern score, causal-prior graph, LLM hypothesis synthesis.
- **Automatic routing**: every individual report (not just detected patterns) is routed
  the instant it's submitted to a department (by category) *and* a zone/ward (by
  location) — see `governance.py` / `risk_escalation.py`.
- **Governance layer**: tracks status (`new → acknowledged → in_progress → resolved`)
  with a public audit trail, and "how far along it is" as a percent-complete progress bar
  visible to both citizens and departments — see "Government Accountability &
  Transparency Layer" in `backend/README.md`.
- **Phone accounts**: citizens register/sign in with just a phone number (OTP, no
  password). A logged-in user's reports are attributed to their verified number
  automatically — see "Phone Accounts" below.
- **Citizen awareness**: "My Reports" shows a logged-in user their own submissions
  automatically — department, zone, status, and completion progress for each — with
  manual lookup by id still available for anonymous/demo use.
- **Public transparency**: an accountability strip on the dashboard (no login) showing
  resolution counts and average response time by department.
- **Predictive risk escalation**: a background check flags problems that have sat open
  past their SLA *and* sit in a zone with severe rain forecast, and notifies the
  responsible department's inbox — see "Predictive Risk Escalation" below.
- **Multi-source root-cause evidence**: NOAA weather (real) and CCTV vision (real, same
  Gemini pipeline as citizen photos) plus satellite/mobility/transit (simulated, clearly
  labeled) feed a "cross-source corroboration" score bonus and evidence-aware AI
  explanations — see `evidence_sources.py`.
- **Cascade risk prediction**: detected patterns are matched against a library of known
  escalation scenarios (e.g. blocked drain → flood → disease outbreak) and rendered as a
  staged severity climb from small observations to what could happen if ignored — see
  `frontend/src/data/cascadeTemplates.ts`.
- **Earn Points / Community Rewards**: citizens earn points for real, verified
  contributions (reporting, evidence, verification, official confirmation, follow-ups),
  track progress toward four contribution levels, and redeem points for rewards from
  community partners — see "Earn Points / Community Rewards" below.

## Phone Accounts

Sign-in is phone number + one-time code, no password. There's no SMS gateway wired up
(that needs a paid provider account this environment doesn't have credentials for), so
`POST /api/auth/request-otp` logs the code server-side and — only while `DEV_EXPOSE_OTP`
is on (default `true`) — also returns it in the response, and the sign-in modal displays
it directly so the flow is demoable end to end. Swap the send step in `auth.py` for a
real provider (Twilio/MSG91/etc.) and set `DEV_EXPOSE_OTP=false` to go to production.

Once logged in, a report's `submitter_id` is set server-side to the verified phone
number regardless of what the client sends — this is what makes "independent
submitters" in the pattern score mean independent *people*. Anonymous submission (a
free-text identifier) still works for demo/offline use.

## Predictive Risk Escalation

`risk_escalation.py` checks Open-Meteo's free forecast API for each zone; a case
(pattern or individual report) that's still open past its response SLA *and* sits in a
zone with elevated/severe rain forecast gets filed as an `Escalation`, surfaced in the
Department Inbox. Runs automatically after every `/api/analyze`, or on demand via
"Check for risk now" in the inbox / `POST /api/escalations/scan`.

No SMS/email/push channel is wired up — the Escalation record *is* the notification in
this build (appears immediately in-app). A live demo can't control whether it's
actually raining wherever `CITY_CENTER` points, so set `DEMO_FORCE_WEATHER_RISK=true`
to force every zone to read as a severe risk for presentation purposes — every
escalation created this way is clearly labeled `"source": "simulated"` in its
`weather_summary`, never silently swapped in for real data.

## Earn Points / Community Rewards

Real contributions earn points — reporting (+10), photo/video evidence (+5), a
meaningful text description (+5), an accurate location (+5), another citizen
verifying the report (+10), an authority acknowledging/resolving it (+25), and a
useful follow-up ≥7 days later (+10). Every rule is "only once": each award is a row
in an append-only ledger keyed by `(user, report, action)`, so re-triggering the same
action is a no-op rather than a race to trust. Spam/duplicate reports (matching photo
hash, or rate-limited rapid-fire submissions) are flagged and earn nothing.

Four lifetime levels (100/200/300/400 pts: Bronze → Silver → Gold → City Champion)
are based on total points *earned*, never current balance, so redeeming a reward can
never demote you. See "Earn Points / Community Rewards" in `backend/README.md` for
the full mechanics, and the **Earn Points** section on the site for the UI: points
summary, level progress bar, a community-verification panel (confirm someone else's
report to earn *them* points), the reward catalog, redemption history, and the
Community Partners section.

## Known MVP limits (worth saying out loud to judges)

- No authentication on the government status-update / escalation-acknowledge
  endpoints — they're a demo console standing in for an authenticated department portal.
- OTP delivery is simulated (logged + returned in dev mode), not sent by real SMS.
- Root-cause hypotheses currently come from citizen reports only; they are not yet
  cross-checked against independent sources (e.g. rainfall history, OSM sidewalk tags),
  which would let the system rule explanations in or out instead of just proposing them.
  (Risk escalation now uses rainfall data for *timing* alerts — the same data source
  would extend naturally to strengthening the causal hypothesis itself.)
