"""
Multi-source root-cause evidence.

The point of this module is accuracy, not volume: citizen reports alone can't
distinguish "drainage failure" from "no footpath exists" from "vendors
blocking it" — they all look the same from a phone photo. Independent
sources that can't be produced by more citizen reports let the system
corroborate or rule out a hypothesis instead of just collecting more of the
same kind of evidence. See config.py's "Multi-source root-cause evidence"
section for exactly what's real vs simulated here, and why.

Every signal returned has the same shape so the pipeline/UI can treat them
uniformly:
    {
        "source_type": str,
        "available": bool,       # could we get a reading at all?
        "relevant": bool,        # does this source speak to this category?
        "is_simulated": bool,    # false only for NOAA and CCTV
        "supports": bool | None, # does it corroborate the hazard? None = n/a
        "summary": dict,         # raw-ish structured reading
        "interpretation": str,   # one-line human-readable takeaway
    }
"""
import logging
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import requests

from config import (
    NOAA_POINTS_URL, NOAA_USER_AGENT, NOAA_REQUEST_TIMEOUT_SECONDS,
    EVIDENCE_SOURCE_RELEVANT_CATEGORIES
)

logger = logging.getLogger(__name__)


def _is_relevant(source_type: str, category: Optional[str]) -> bool:
    if not category:
        return False
    return category in EVIDENCE_SOURCE_RELEVANT_CATEGORIES.get(source_type, [])


def _empty_signal(source_type: str, relevant: bool, reason: str) -> Dict[str, Any]:
    return {
        "source_type": source_type,
        "available": False,
        "relevant": relevant,
        "is_simulated": source_type not in ("noaa_weather",),
        "supports": None,
        "summary": {},
        "interpretation": reason,
    }


# --- REAL: NOAA (api.weather.gov) ---

def fetch_noaa_weather(lat: float, lon: float, category: Optional[str]) -> Dict[str, Any]:
    """
    Real data from the US National Weather Service. US coverage only — NOAA
    returns 404 for points outside the US, handled gracefully below.
    """
    source_type = "noaa_weather"
    relevant = _is_relevant(source_type, category)
    headers = {"User-Agent": NOAA_USER_AGENT}
    try:
        points_resp = requests.get(
            NOAA_POINTS_URL.format(lat=lat, lon=lon), headers=headers, timeout=NOAA_REQUEST_TIMEOUT_SECONDS
        )
        if points_resp.status_code != 200:
            return _empty_signal(source_type, relevant, "No NOAA coverage for this location (outside the US).")
        props = points_resp.json().get("properties", {})
        forecast_url = props.get("forecast")
        if not forecast_url:
            return _empty_signal(source_type, relevant, "NOAA forecast unavailable for this location.")

        forecast_resp = requests.get(forecast_url, headers=headers, timeout=NOAA_REQUEST_TIMEOUT_SECONDS)
        forecast_resp.raise_for_status()
        periods = forecast_resp.json().get("properties", {}).get("periods", [])
        if not periods:
            return _empty_signal(source_type, relevant, "NOAA returned no forecast periods.")

        current = periods[0]
        precip_prob = (current.get("probabilityOfPrecipitation") or {}).get("value")
        short_forecast = current.get("shortForecast", "")
        temp_f = current.get("temperature")

        precip_prob = precip_prob if precip_prob is not None else 0
        rain_worded = any(w in short_forecast.lower() for w in ["rain", "shower", "storm", "drizzle"])
        supports = relevant and (precip_prob >= 40 or rain_worded)

        summary = {
            "period": current.get("name"),
            "precipitation_probability_pct": precip_prob,
            "short_forecast": short_forecast,
            "temperature_f": temp_f,
            "station_grid": props.get("gridId"),
        }
        interpretation = (
            f"NOAA forecast ({current.get('name')}): {short_forecast}, "
            f"{precip_prob}% precipitation probability."
        )
        return {
            "source_type": source_type,
            "available": True,
            "relevant": relevant,
            "is_simulated": False,
            "supports": supports if relevant else None,
            "summary": summary,
            "interpretation": interpretation,
        }
    except Exception as e:
        logger.warning(f"NOAA fetch failed for ({lat}, {lon}): {e}")
        return _empty_signal(source_type, relevant, "NOAA request failed (network or service issue).")


# --- REAL: CCTV / traffic camera computer vision ---
# Uses the same Gemini vision perception as citizen photo reports — see
# perception.run_perception, called directly from main.py's
# /api/camera-feeds/ingest rather than duplicated here. This module only
# describes camera evidence in the pattern-level signal summary (count of
# camera-sourced events already folded into the cluster).

def summarize_camera_evidence(camera_event_count: int, category: Optional[str]) -> Dict[str, Any]:
    """
    Not a live fetch — summarizes CCTV-sourced events already present in a
    detected cluster (created via the real vision pipeline at ingest time)
    for consistent display alongside the other evidence sources.
    """
    source_type = "cctv_camera"
    relevant = camera_event_count > 0
    return {
        "source_type": source_type,
        "available": camera_event_count > 0,
        "relevant": relevant,
        "is_simulated": False,
        "supports": camera_event_count > 0 if relevant else None,
        "summary": {"camera_sourced_events": camera_event_count},
        "interpretation": (
            f"{camera_event_count} fixed-camera observation(s) (Gemini vision) corroborate this cluster, "
            f"independent of citizen submissions."
            if camera_event_count > 0 else "No fixed-camera coverage reporting in this cluster."
        ),
    }


# --- SIMULATED: satellite, mobility GPS, public transit ---
# Each is deterministic per (pattern, source) via a locally-seeded RNG, not
# global `random` state — same pattern gets a stable reading across calls
# within a session, different patterns/zones get different readings.

def fetch_satellite_signal(zone_name: str, category: Optional[str], seed_key: str) -> Dict[str, Any]:
    source_type = "satellite"
    relevant = _is_relevant(source_type, category)
    if not relevant:
        return _empty_signal(source_type, relevant, "Not applicable to this category.")

    rng = random.Random(f"satellite:{seed_key}")
    water_extent_sqm = round(rng.uniform(40, 550), 0)
    pass_days_ago = rng.randint(0, 2)
    supports = water_extent_sqm > 150 if category == "standing_water" else water_extent_sqm > 250

    summary = {
        "estimated_surface_water_extent_sqm": water_extent_sqm,
        "pass_date": (datetime.utcnow() - timedelta(days=pass_days_ago)).strftime("%Y-%m-%d"),
        "resolution": "10m (simulated Sentinel-2-style NDWI pass)",
    }
    interpretation = (
        f"[SIMULATED] Satellite pass ({summary['pass_date']}) estimates "
        f"~{int(water_extent_sqm)}m² of standing surface water in this zone."
    )
    return {
        "source_type": source_type, "available": True, "relevant": True,
        "is_simulated": True, "supports": supports,
        "summary": summary, "interpretation": interpretation,
    }


def fetch_mobility_signal(zone_name: str, category: Optional[str], seed_key: str) -> Dict[str, Any]:
    source_type = "mobility_gps"
    relevant = _is_relevant(source_type, category)
    if not relevant:
        return _empty_signal(source_type, relevant, "Not applicable to this category.")

    rng = random.Random(f"mobility:{seed_key}")
    baseline_speed_kmh = 28.0
    avg_speed_kmh = round(rng.uniform(7.0, 22.0), 1)
    congestion_index = round(max(0.0, 1.0 - (avg_speed_kmh / baseline_speed_kmh)), 2)
    supports = congestion_index > 0.35

    summary = {
        "avg_speed_kmh": avg_speed_kmh,
        "baseline_speed_kmh": baseline_speed_kmh,
        "congestion_index": congestion_index,
    }
    interpretation = (
        f"[SIMULATED] GPS-derived average speed in this zone is {avg_speed_kmh} km/h "
        f"vs a {baseline_speed_kmh} km/h baseline (congestion index {congestion_index})."
    )
    return {
        "source_type": source_type, "available": True, "relevant": True,
        "is_simulated": True, "supports": supports,
        "summary": summary, "interpretation": interpretation,
    }


def fetch_transit_signal(zone_name: str, category: Optional[str], seed_key: str) -> Dict[str, Any]:
    source_type = "public_transit"
    relevant = _is_relevant(source_type, category)
    if not relevant:
        return _empty_signal(source_type, relevant, "Not applicable to this category.")

    rng = random.Random(f"transit:{seed_key}")
    footfall_delta_pct = round(rng.uniform(-10.0, 35.0), 1)
    supports = footfall_delta_pct > 15.0

    summary = {
        "nearest_station": f"{zone_name} Transit Hub",
        "street_level_footfall_delta_pct": footfall_delta_pct,
    }
    interpretation = (
        f"[SIMULATED] Entry/exit counts near {summary['nearest_station']} imply "
        f"{'a ' + str(footfall_delta_pct) + '% increase' if footfall_delta_pct >= 0 else str(abs(footfall_delta_pct)) + '% decrease'} "
        f"in street-level pedestrian activity vs baseline."
    )
    return {
        "source_type": source_type, "available": True, "relevant": True,
        "is_simulated": True, "supports": supports,
        "summary": summary, "interpretation": interpretation,
    }


def gather_evidence_for_pattern(
    lat: float, lon: float, zone_name: str, dominant_category: Optional[str],
    seed_key: str, camera_event_count: int = 0
) -> Dict[str, Dict[str, Any]]:
    """Orchestrates all sources for one detected pattern. Never raises."""
    signals = {}
    try:
        signals["noaa_weather"] = fetch_noaa_weather(lat, lon, dominant_category)
    except Exception as e:
        logger.warning(f"NOAA signal failed: {e}")
        signals["noaa_weather"] = _empty_signal("noaa_weather", False, "Unavailable.")

    signals["satellite"] = fetch_satellite_signal(zone_name, dominant_category, seed_key)
    signals["mobility_gps"] = fetch_mobility_signal(zone_name, dominant_category, seed_key)
    signals["public_transit"] = fetch_transit_signal(zone_name, dominant_category, seed_key)
    signals["cctv_camera"] = summarize_camera_evidence(camera_event_count, dominant_category)

    return signals
