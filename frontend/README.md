# CityTwin Frontend Dashboard

CityTwin is a modern, light-themed urban planning intelligence dashboard built with React 18, Vite, TypeScript, Tailwind CSS, Leaflet (`react-leaflet`), and Recharts.

---

## Features

1. **Dual-Mode Map Visualization (`MapView.tsx`)**:
   - **Standard complaint view**: Renders raw citizen observation reports as uniform grey pins (the baseline state).
   - **CityTwin view**: Color-codes observations by urban category and draws highlighted pulsing hotspot circles around detected patterns labeled with pattern scores.

2. **Pattern Intelligence Panel (`PatternDetail.tsx`)**:
   - **Headline Stats**: Score, total events, independent submitter sources, peak temporal window, perception confidence.
   - **Explainable Score Breakdown**: Horizontal progress bars for 6 core metrics (`independent_evidence`, `spatial_consistency`, `temporal_recurrence`, `category_cooccurrence`, `detection_confidence`, `duplication_penalty`).
   - **Causal Prior Graph**: Directed category graph with animated stroke dashes and weighted influence links.
   - **Temporal Timeline**: Hourly event distribution bar chart highlighting the peak concentration window.
   - **Observed Facts vs Candidate Explanations**: Empirical facts vs AI hypotheses (with confidence bars) + City Authority disclaimer.
   - **Field Checklist**: Interactive investigation items for municipal inspectors.
   - **Evidence Table**: Sortable table of events with severity indicators, submitter IDs, thumbnail previews, and synthetic tags.
   - **Source Distribution**: Submitter report frequency chart + ground-truth caution note.
   - **Intervention Simulation View**: Post-remediation before/after comparison chart showing category report reductions (~72-85% drop).

3. **Citizen Reporting Page (`/report`)**:
   - Photo upload drag-and-drop with thumbnail preview.
   - Location pin dropper + "Use my location" GPS button.
   - Immediate feedback showing AI perception category chips, severity, and confidence.

---

## Setup & Running Instructions

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables (optional)
Leave `VITE_API_BASE_URL` unset/empty in `/frontend/.env` — the app defaults to same-origin
relative requests, which works both under `vite dev` (proxied to `localhost:8000`, see
`vite.config.ts`) and when the built app is served directly by the backend (see below). Only
set it if the backend is hosted at a different origin than the page.

### 3. Run Development Server (hot reload, for active frontend work)
```bash
npm run dev
```
The app will start at **`http://localhost:5173`** and proxy `/api` + `/uploads` to `http://localhost:8000`.

### 3b. Or: build once and let the backend serve it (single URL, recommended for demos)
```bash
npm run build
```
This produces `frontend/dist`. Start the backend (see `backend/README.md`) and it will
auto-detect and serve `frontend/dist` at `http://localhost:8000` — one server, one URL,
no CORS, nothing else to run. See the root [README.md](../README.md) for the one-command version.

---

## Demo Workflow

1. Open `http://localhost:5173` in your browser.
2. Click **"Load demo data"** in the top bar -> 62 synthetic citizen reports load as plain grey pins on the map (Standard view).
3. Click **"Run CityTwin analysis"** -> automatically switches to CityTwin view -> a single multi-hazard pattern hotspot appears (the decoy garbage cluster is ignored).
4. Click the hotspot circle on the map -> the right panel populates with pattern details, causal graph, timeline, and explanations.
5. Click **"Simulate intervention"** -> displays before/after comparison chart with ~72-85% reduction in problem category reports.
