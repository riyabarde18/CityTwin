import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if available
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)

# Gemini API Key configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
IS_MOCK_MODE = not GEMINI_API_KEY or GEMINI_API_KEY == "PASTE_KEY_HERE"

# Database & Uploads paths
BASE_DIR = Path(__file__).parent.resolve()
DATABASE_URL = f"sqlite:///{BASE_DIR / 'citytwin.db'}"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Fixed Categories
CATEGORIES = [
    "standing_water",
    "footpath_obstruction",
    "pedestrian_on_road",
    "traffic_slowdown",
    "damaged_surface",
    "garbage",
    "unsafe_crossing",
    "accessibility_barrier"
]

# Rule-based Causal Prior Graph
# Directed edges: source -> target
CAUSAL_PRIORS = [
    ("standing_water", "footpath_obstruction"),
    ("footpath_obstruction", "pedestrian_on_road"),
    ("pedestrian_on_road", "traffic_slowdown"),
    ("damaged_surface", "pedestrian_on_road"),
    ("unsafe_crossing", "pedestrian_on_road")
]

# Configurable City Center Zone (San Francisco default)
CITY_CENTER_LAT = float(os.getenv("CITY_CENTER_LAT", "37.7749"))
CITY_CENTER_LON = float(os.getenv("CITY_CENTER_LON", "-122.4194"))

# Analysis Thresholds
DBSCAN_EPS_METERS = 60.0  # Spatial epsilon in meters (~60 meters)
EARTH_RADIUS_METERS = 6371000.0
DBSCAN_EPS_RADIANS = DBSCAN_EPS_METERS / EARTH_RADIUS_METERS
DBSCAN_MIN_SAMPLES = 4

# Pattern Filtering Criteria
MIN_PATTERN_SCORE = 50.0
MIN_DISTINCT_CATEGORIES = 3
MIN_INDEPENDENT_SUBMITTERS = 4
LIFT_THRESHOLD = 1.5

# Disclaimer for LLM Pattern Details
DISCLAIMER = "Hypothesis for investigation; verification by the city authority required."

# --- Government Accountability & Transparency Layer ---

# Maps each detected category to the municipal department that would realistically
# own investigation/repair for it. Used to auto-route a detected pattern to a
# responsible body instead of leaving it as an anonymous "complaint".
CATEGORY_TO_DEPARTMENT = {
    "standing_water": "Storm Water Drainage Dept.",
    "footpath_obstruction": "Roads & Footpaths (PWD)",
    "pedestrian_on_road": "Traffic Police / Road Safety Cell",
    "traffic_slowdown": "Traffic Police / Road Safety Cell",
    "damaged_surface": "Roads & Footpaths (PWD)",
    "garbage": "Solid Waste Management",
    "unsafe_crossing": "Traffic Police / Road Safety Cell",
    "accessibility_barrier": "Accessibility & Disability Affairs Cell",
}
DEFAULT_DEPARTMENT = "Municipal Operations (General)"

# Lifecycle a pattern moves through once flagged. Kept intentionally small so a
# government-side user can update it with one click during the demo.
PATTERN_STATUSES = ["new", "acknowledged", "in_progress", "resolved", "rejected"]
DEFAULT_STATUS = "new"

# Response-time targets (days) used to compute an SLA due date and flag overdue
# patterns on the public transparency view. Deliberately simple/uniform for the
# hackathon MVP; a production system would vary this by department and severity.
SLA_DAYS_TO_ACKNOWLEDGE = 2
SLA_DAYS_TO_RESOLVE = 14

# --- Jurisdiction / Area Zones ---
# "That particular government section in that area" needs an area, not just a
# category. Real municipal ward/constituency polygons aren't available for a
# hackathon MVP, so this approximates jurisdiction with a small synthetic ward
# grid centered on CITY_CENTER_LAT/LON: a report is auto-assigned to whichever
# zone center it's nearest to (see governance.assign_zone). Swap this for real
# ward boundaries (e.g. municipal GIS shapefiles or OSM boundary relations) in
# production — nearest-center is a reasonable stand-in, not a source of truth.
_ZONE_STEP_DEG = 0.01  # ~1.1 km at the equator
CITY_ZONES = [
    {"zone_id": "WARD_CENTRAL", "name": "Ward Central", "lat_offset": 0.0, "lon_offset": 0.0},
    {"zone_id": "WARD_NORTH", "name": "Ward North", "lat_offset": _ZONE_STEP_DEG, "lon_offset": 0.0},
    {"zone_id": "WARD_SOUTH", "name": "Ward South", "lat_offset": -_ZONE_STEP_DEG, "lon_offset": 0.0},
    {"zone_id": "WARD_EAST", "name": "Ward East", "lat_offset": 0.0, "lon_offset": _ZONE_STEP_DEG},
    {"zone_id": "WARD_WEST", "name": "Ward West", "lat_offset": 0.0, "lon_offset": -_ZONE_STEP_DEG},
]
for _z in CITY_ZONES:
    _z["center_lat"] = CITY_CENTER_LAT + _z["lat_offset"]
    _z["center_lon"] = CITY_CENTER_LON + _z["lon_offset"]
DEFAULT_ZONE_NAME = "Unzoned / Citywide"

# --- Phone-based accounts ---
# OTP delivery is simulated (no SMS gateway credentials in a hackathon
# environment): request-otp logs the code server-side and — only while
# IS_MOCK_MODE / DEV_EXPOSE_OTP is on — returns it directly in the API
# response so the demo is self-contained. Swap request_otp's send step in
# auth.py for a real provider (Twilio/MSG91/etc.) to go to production.
DEV_EXPOSE_OTP = os.getenv("DEV_EXPOSE_OTP", "true").lower() in ("1", "true", "yes")
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
SESSION_EXPIRY_DAYS = 30

# --- Progress visibility ---
# "How far along is it" for a citizen, without requiring an officer to type a
# number every time: a sensible default per lifecycle stage, which an officer
# can override with a specific percent via StatusUpdateRequest.progress_percent.
DEFAULT_PROGRESS_BY_STATUS = {
    "new": 0,
    "acknowledged": 20,
    "in_progress": 60,
    "resolved": 100,
    "rejected": 0,
}

# --- Predictive risk escalation ---
# A problem that's been open past its SLA is a nuisance; the same problem
# sitting open while severe weather is forecast for its zone is a risk that
# should reach the responsible department proactively, not wait for a citizen
# to escalate it. Only categories weather can plausibly worsen are checked.
WEATHER_SENSITIVE_CATEGORIES = [
    "standing_water", "footpath_obstruction", "pedestrian_on_road",
    "traffic_slowdown", "damaged_surface", "unsafe_crossing", "accessibility_barrier"
]
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_FORECAST_DAYS = 2
WEATHER_REQUEST_TIMEOUT_SECONDS = 6

# Risk thresholds: (min precipitation probability %, min precipitation mm)
# over the forecast window. Deliberately simple/uniform for the hackathon MVP.
RISK_THRESHOLD_ELEVATED = {"probability_pct": 60, "precip_mm": 15.0}
RISK_THRESHOLD_SEVERE = {"probability_pct": 80, "precip_mm": 30.0}

# Don't re-notify a department every time the scan runs for a case that's
# already been flagged and not yet acknowledged.
ESCALATION_DEDUPE_HOURS = 12

# The real Open-Meteo forecast is used by default. Since a live demo can't
# control whether it's actually raining wherever CITY_CENTER points, set
# this to force every zone to read as a severe weather risk — clearly
# labeled as simulated in the resulting escalation, never silently swapped in.
DEMO_FORCE_WEATHER_RISK = os.getenv("DEMO_FORCE_WEATHER_RISK", "false").lower() in ("1", "true", "yes")

# --- Multi-source root-cause evidence ---
# Root-cause accuracy comes from evidence that can't be produced by more
# citizen reports: independent, non-human sources that can corroborate or
# rule out a hypothesis. See evidence_sources.py.
#
# What's real vs simulated in this build, and why:
#   - NOAA weather   : REAL  — api.weather.gov is free/keyless (US coverage only).
#   - CCTV / vision  : REAL  — reuses the same Gemini vision pipeline already
#                      used for citizen photos (perception.py), just pointed at
#                      POST /api/camera-feeds/ingest instead of a phone camera.
#   - Satellite      : SIMULATED — Sentinel Hub / Planet / Earth Engine all
#                      require a paid API key not available in this environment.
#   - Mobility (GPS) : SIMULATED — Google/TomTom/HERE traffic APIs require a
#                      paid key.
#   - Public transit : SIMULATED — entry/exit APIs vary per transit agency and
#                      need registration per city; no universal free source.
# Simulated sources are clearly flagged `is_simulated: true` everywhere they
# appear (API responses and UI) and are deterministic per pattern (seeded),
# not random noise — see evidence_sources.py for the swap-in points.

NOAA_POINTS_URL = "https://api.weather.gov/points/{lat},{lon}"
NOAA_USER_AGENT = "CityTwin-Hackathon-Demo (contact: demo@citytwin.example)"
NOAA_REQUEST_TIMEOUT_SECONDS = 6

# Categories each source type can plausibly speak to — gates which signals
# are treated as "relevant" (and thus scored/explained) for a given pattern,
# so e.g. a garbage pattern doesn't get an irrelevant satellite water reading.
EVIDENCE_SOURCE_RELEVANT_CATEGORIES = {
    "noaa_weather": ["standing_water", "footpath_obstruction", "damaged_surface", "unsafe_crossing"],
    "satellite": ["standing_water", "damaged_surface", "footpath_obstruction"],
    "mobility_gps": ["traffic_slowdown", "pedestrian_on_road", "unsafe_crossing"],
    "public_transit": ["pedestrian_on_road", "traffic_slowdown"],
}

# Max bonus points the cross-source corroboration score component can add
# (see pipeline.compute_pattern_score) — additive on top of the existing
# 0-100 score, which stays clamped to 100 overall.
CROSS_SOURCE_BONUS_MAX_PTS = 15.0
