import math
import logging
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN

from config import (
    CATEGORIES, CAUSAL_PRIORS, DBSCAN_EPS_RADIANS, DBSCAN_MIN_SAMPLES,
    EARTH_RADIUS_METERS, LIFT_THRESHOLD, MIN_PATTERN_SCORE,
    MIN_DISTINCT_CATEGORIES, MIN_INDEPENDENT_SUBMITTERS, DISCLAIMER,
    GEMINI_API_KEY, IS_MOCK_MODE, CROSS_SOURCE_BONUS_MAX_PTS
)
from models import EventModel
import governance
import evidence_sources

logger = logging.getLogger(__name__)

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates haversine distance in meters between two lat/lon points."""
    r = EARTH_RADIUS_METERS
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def compute_spatial_clusters(events: List[EventModel]) -> Dict[int, List[EventModel]]:
    """Step 1: Spatial DBSCAN clustering using haversine metric."""
    if not events:
        return {}

    # Extract coordinates in radians
    coords_rad = np.array([[math.radians(e.lat), math.radians(e.lon)] for e in events])
    
    db = DBSCAN(eps=DBSCAN_EPS_RADIANS, min_samples=DBSCAN_MIN_SAMPLES, metric='haversine')
    labels = db.fit_predict(coords_rad)

    clusters: Dict[int, List[EventModel]] = {}
    for idx, label in enumerate(labels):
        if label == -1:
            continue  # Noise
        clusters.setdefault(label, []).append(events[idx])

    # Further subgroup by road_segment_id if available
    final_clusters = {}
    cluster_counter = 0
    for label, cluster_events in clusters.items():
        road_groups = {}
        for ev in cluster_events:
            seg_key = ev.road_segment_id or "default"
            road_groups.setdefault(seg_key, []).append(ev)
        
        for seg_key, sub_events in road_groups.items():
            if len(sub_events) >= DBSCAN_MIN_SAMPLES:
                final_clusters[cluster_counter] = sub_events
                cluster_counter += 1

    return final_clusters

def compute_temporal_window(events: List[EventModel]) -> Tuple[str, int, float]:
    """Step 2: Temporal binning to find peak 2-hour window and distinct day count."""
    if not events:
        return "00:00-23:59", 0, 0.0

    hours = [ev.timestamp.hour for ev in events]
    dates = set(ev.timestamp.date() for ev in events)
    days_observed = max(1, len(dates))

    # Bin into 2-hour windows (e.g., 00:00-02:00, 01:00-03:00, ..., 22:00-24:00)
    best_window = "17:30-19:30"
    max_count = 0
    
    for start_h in range(24):
        end_h = (start_h + 2) % 24
        count = sum(1 for h in hours if (h == start_h or h == (start_h + 1) % 24))
        if count > max_count:
            max_count = count
            best_window = f"{start_h:02d}:30-{(start_h + 2) % 24:02d}:30"

    peak_share = max_count / len(events)
    return best_window, days_observed, peak_share

def compute_category_lifts(
    cluster_events: List[EventModel],
    all_events: List[EventModel]
) -> Dict[str, float]:
    """Step 3: Calculate category co-occurrence lift compared to citywide baseline."""
    total_city = max(1, len(all_events))
    total_cluster = max(1, len(cluster_events))

    city_counts = {}
    for ev in all_events:
        city_counts[ev.category] = city_counts.get(ev.category, 0) + 1

    cluster_counts = {}
    for ev in cluster_events:
        cluster_counts[ev.category] = cluster_counts.get(ev.category, 0) + 1

    lifts = {}
    for cat in CATEGORIES:
        city_share = city_counts.get(cat, 0) / total_city
        cluster_share = cluster_counts.get(cat, 0) / total_cluster
        baseline = max(city_share, 0.001)
        lifts[cat] = round(cluster_share / baseline, 2)

    return lifts

def check_causal_chain(present_categories: List[str]) -> bool:
    """Checks if present categories form a chain in the causal prior graph."""
    cat_set = set(present_categories)
    chain_length = 0
    for src, tgt in CAUSAL_PRIORS:
        if src in cat_set and tgt in cat_set:
            chain_length += 1
    return chain_length >= 2

def compute_pattern_score(
    cluster_events: List[EventModel],
    lifts: Dict[str, float],
    days_observed: int,
    peak_share: float,
    evidence_signals: Dict[str, Dict[str, Any]] = None
) -> Tuple[float, Dict[str, float]]:
    """Step 4: Explainable Pattern Scoring (0-100)."""
    # 1. Independent evidence (max 25 pts)
    submitter_ids = set(e.submitter_id for e in cluster_events)
    independent_count = len(submitter_ids)
    score_indep = min(25.0, (independent_count / 10.0) * 25.0)

    # 2. Spatial consistency / tightness (max 20 pts)
    lats = [e.lat for e in cluster_events]
    lons = [e.lon for e in cluster_events]
    center_lat, center_lon = sum(lats) / len(lats), sum(lons) / len(lons)
    dists = [haversine_distance_meters(center_lat, center_lon, e.lat, e.lon) for e in cluster_events]
    avg_dist = sum(dists) / len(dists)
    score_spatial = max(0.0, min(20.0, 20.0 - (avg_dist / 3.0)))

    # 3. Temporal recurrence (max 20 pts)
    score_temporal_window = peak_share * 10.0
    score_temporal_days = min(10.0, (days_observed / 4.0) * 10.0)
    score_temporal = min(20.0, score_temporal_window + score_temporal_days)

    # 4. Category co-occurrence & causal chain bonus (max 25 pts)
    high_lift_cats = [cat for cat, l in lifts.items() if l > LIFT_THRESHOLD and any(e.category == cat for e in cluster_events)]
    distinct_cats = set(e.category for e in cluster_events)
    base_cooc_score = min(15.0, (len(high_lift_cats) / 4.0) * 15.0)
    chain_bonus = 10.0 if check_causal_chain(list(distinct_cats)) else 0.0
    score_cooccur = min(25.0, base_cooc_score + chain_bonus)

    # 5. Detection confidence (max 10 pts)
    avg_conf = sum(e.confidence for e in cluster_events) / len(cluster_events)
    score_conf = min(10.0, avg_conf * 10.0)

    # Deduplication / noise penalty (up to -20 pts)
    penalty = 0.0
    # Check for submitter repetitions within tight timestamp
    sorted_events = sorted(cluster_events, key=lambda x: x.timestamp)
    for i in range(1, len(sorted_events)):
        if sorted_events[i].submitter_id == sorted_events[i-1].submitter_id:
            tdiff = (sorted_events[i].timestamp - sorted_events[i-1].timestamp).total_seconds()
            if tdiff < 300:  # within 5 mins
                penalty += 3.0
    # Duplicate image hashes
    hashes = [e.image_hash for e in cluster_events if e.image_hash]
    if len(hashes) > len(set(hashes)):
        penalty += (len(hashes) - len(set(hashes))) * 4.0
    penalty = min(20.0, penalty)

    # 6. Cross-source corroboration (bonus, up to CROSS_SOURCE_BONUS_MAX_PTS).
    # Two independent kinds of corroboration, both worth more than another
    # citizen report saying the same thing:
    #   a) distinct evidence_source_type values actually present in this
    #      cluster (e.g. citizen photos + CCTV vision agreeing) — real.
    #   b) external signals (NOAA/satellite/mobility/transit) that are
    #      relevant to this category and support the hazard.
    distinct_event_sources = len(set(e.evidence_source_type for e in cluster_events))
    cross_event_bonus = (distinct_event_sources - 1) * 7.0  # 0 if citizen-only

    external_supportive = 0
    if evidence_signals:
        for sig in evidence_signals.values():
            if sig.get("relevant") and sig.get("supports"):
                external_supportive += 1
    external_bonus = external_supportive * 4.0

    score_cross_source = round(min(CROSS_SOURCE_BONUS_MAX_PTS, cross_event_bonus + external_bonus), 1)

    raw_total = score_indep + score_spatial + score_temporal + score_cooccur + score_conf - penalty + score_cross_source
    final_score = round(max(0.0, min(100.0, raw_total)), 1)

    breakdown = {
        "independent_evidence": round(score_indep, 1),
        "spatial_consistency": round(score_spatial, 1),
        "temporal_recurrence": round(score_temporal, 1),
        "category_cooccurrence": round(score_cooccur, 1),
        "detection_confidence": round(score_conf, 1),
        "cross_source_corroboration": score_cross_source,
        "duplication_penalty": round(-penalty, 1)
    }

    return final_score, breakdown

def build_causal_graph(cluster_events: List[EventModel]) -> Dict[str, Any]:
    """Step 6: Construct rule-based causal prior graph."""
    cat_counts = {}
    for e in cluster_events:
        cat_counts[e.category] = cat_counts.get(e.category, 0) + 1

    nodes = []
    for cat, count in cat_counts.items():
        nodes.append({"id": cat, "category": cat, "count": count})

    edges = []
    total_ev = len(cluster_events)
    for src, tgt in CAUSAL_PRIORS:
        if src in cat_counts and tgt in cat_counts:
            cooc_weight = round(min(cat_counts[src], cat_counts[tgt]) / total_ev, 2)
            edges.append({
                "source": src,
                "target": tgt,
                "weight": max(0.1, cooc_weight)
            })

    return {"nodes": nodes, "edges": edges}

def generate_llm_explanation(
    cluster_events: List[EventModel],
    top_categories: List[str],
    lifts: Dict[str, float],
    time_window: str,
    days_observed: int,
    graph: Dict[str, Any],
    evidence_signals: Dict[str, Dict[str, Any]] = None
) -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
    """Step 7: Gemini LLM explanation synthesis or Mock fallback, evidence-aware."""
    evidence_signals = evidence_signals or {}
    cat_counts = {}
    for e in cluster_events:
        cat_counts[e.category] = cat_counts.get(e.category, 0) + 1

    citizen_count = sum(1 for e in cluster_events if e.evidence_source_type == "citizen_report")
    camera_count = sum(1 for e in cluster_events if e.evidence_source_type == "cctv_camera")

    observed_facts = [
        f"Detected {len(cluster_events)} observations across {days_observed} distinct days "
        f"({citizen_count} citizen report(s){f', {camera_count} fixed-camera detection(s)' if camera_count else ''}).",
        f"Peak concentration observed during window {time_window}.",
        f"Primary co-occurring problem categories: {', '.join(top_categories)}.",
        f"Highest category lift observed for {top_categories[0] if top_categories else 'n/a'} (lift: {lifts.get(top_categories[0], 1.0) if top_categories else 1.0})."
    ]
    # Fold in every available external signal as its own observed fact, so
    # "observed facts" vs "candidate explanations" stays a real distinction:
    # these are independent readings, not AI inference.
    for sig in evidence_signals.values():
        if sig.get("available") and sig.get("relevant") and sig.get("interpretation"):
            observed_facts.append(sig["interpretation"])

    supportive_sources = [
        {"noaa_weather": "NOAA Weather", "satellite": "Satellite (simulated)",
         "mobility_gps": "Mobility GPS (simulated)", "public_transit": "Public Transit (simulated)",
         "cctv_camera": "CCTV Camera"}[key]
        for key, sig in evidence_signals.items()
        if sig.get("relevant") and sig.get("supports") and key in {
            "noaa_weather", "satellite", "mobility_gps", "public_transit", "cctv_camera"
        }
    ]

    if IS_MOCK_MODE or not GEMINI_API_KEY:
        # Mock explanation template logic — confidence and phrasing respond
        # to whether independent sources actually corroborate the hypothesis,
        # not just to citizen report volume.
        h1_boost = 0.06 * len(supportive_sources)
        h1_confidence = round(min(0.97, 0.80 + h1_boost), 2)
        h1_corroboration = (
            f" Corroborated by: {', '.join(supportive_sources)}." if supportive_sources
            else " No independent source corroboration yet — treat as citizen-report-only signal."
        )
        explanations = [
            {
                "explanation": (
                    f"Hypothesis 1: Recurring peak-hour drainage congestion ({top_categories[0] if top_categories else 'standing_water'}) "
                    f"creates pedestrian spillover into active traffic lanes.{h1_corroboration}"
                ),
                "confidence": h1_confidence,
                "supporting_categories": top_categories[:3],
                "supporting_evidence_sources": supportive_sources
            },
            {
                "explanation": "Hypothesis 2: Infrastructure sidewalk degradation combined with temporary street obstacles forces commuters onto vehicular roadways during evening rush hours.",
                "confidence": 0.75 if supportive_sources else 0.70,
                "supporting_categories": top_categories[1:4] if len(top_categories) > 1 else top_categories,
                "supporting_evidence_sources": []
            }
        ]
        recommendations = [
            "Deploy city field inspectors during the 17:30-19:30 peak window for physical site audit.",
            "Inspect storm drain inlets and clear sidewalk obstructions along the designated road segment.",
            "Verify traffic safety measures and crosswalk signage at the affected intersection."
        ]
        return observed_facts, explanations, recommendations

    # Call Gemini API if Key present
    models_to_try = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]
    for model_name in models_to_try:
        try:
            from google import genai
            from google.genai import types

            # http_options timeout caps each attempt so a quota 429 or slow
            # network can't hang /api/analyze for minutes — the SDK's
            # built-in AFC retry/backoff otherwise waits out the server's
            # suggested retry-after (tens of seconds) per model tried.
            client = genai.Client(
                api_key=GEMINI_API_KEY,
                http_options=types.HttpOptions(timeout=12_000)  # milliseconds
            )

            external_evidence = {
                key: {
                    "is_simulated": sig.get("is_simulated"),
                    "supports_hazard": sig.get("supports"),
                    "interpretation": sig.get("interpretation"),
                }
                for key, sig in evidence_signals.items()
                if sig.get("available") and sig.get("relevant")
            }

            evidence_summary = {
                "total_events": len(cluster_events),
                "citizen_report_count": citizen_count,
                "cctv_camera_count": camera_count,
                "days_observed": days_observed,
                "time_window": time_window,
                "category_counts": cat_counts,
                "category_lifts": {k: v for k, v in lifts.items() if v > 1.5},
                "causal_graph": graph,
                "external_evidence_sources": external_evidence
            }

            prompt = (
                f"You are an expert urban systems intelligence engine. Synthesize the following structured evidence into an explainable urban pattern diagnosis.\n"
                f"Evidence JSON: {json.dumps(evidence_summary)}\n\n"
                f"RULES:\n"
                f"1. NEVER claim a proven root cause. Always phrase explanations as hypotheses.\n"
                f"2. external_evidence_sources are independent, non-citizen readings (some marked is_simulated=true, "
                f"meaning a stand-in for a paid API not available in this environment — treat simulated sources as "
                f"illustrative, not as strong evidence as noaa_weather or cctv_camera which are real). Use them to "
                f"explicitly corroborate or weaken each hypothesis, and say when a source is simulated.\n"
                f"3. Always end with a recommendation for field verification by city authorities.\n"
                f"4. Return a JSON object with keys: candidate_explanations (list of {{explanation: str, confidence: float 0-1, "
                f"supporting_categories: list[str], supporting_evidence_sources: list[str] naming which external_evidence_sources keys support it}}), "
                f"and recommended_investigation (list of str)."
            )

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )

            if response and response.text:
                parsed = json.loads(response.text)
                explanations = parsed.get("candidate_explanations", [])
                recommendations = parsed.get("recommended_investigation", [])
                for exp in explanations:
                    exp.setdefault("supporting_evidence_sources", [])
                if explanations and recommendations:
                    return observed_facts, explanations, recommendations
        except Exception as err:
            logger.warning(f"Gemini explanation generation with {model_name} failed: {err}")
            continue

    # Fallback if call fails
    explanations = [
        {
            "explanation": f"Hypothesis 1: Multi-factor urban hazard cascade originating from {top_categories[0] if top_categories else 'standing_water'} causing downstream pedestrian traffic conflicts.",
            "confidence": 0.82,
            "supporting_categories": top_categories[:3],
            "supporting_evidence_sources": supportive_sources
        }
    ]
    recommendations = [
        "Conduct immediate field audit during peak time window to confirm physical root cause."
    ]
    return observed_facts, explanations, recommendations

def run_full_pipeline(all_events: List[EventModel]) -> List[Dict[str, Any]]:
    """Runs the complete 7-step analysis pipeline on all 'before' events."""
    before_events = [e for e in all_events if e.period == "before"]
    if len(before_events) < DBSCAN_MIN_SAMPLES:
        logger.info("Not enough events to run spatial clustering")
        return []

    spatial_clusters = compute_spatial_clusters(before_events)
    detected_patterns = []

    for cluster_id, cluster_events in spatial_clusters.items():
        distinct_categories = set(e.category for e in cluster_events)
        submitter_ids = set(e.submitter_id for e in cluster_events)

        # Calculate lifts
        lifts = compute_category_lifts(cluster_events, before_events)
        time_window, days_observed, peak_share = compute_temporal_window(cluster_events)

        # Calculate Center & Radius (moved earlier: needed to locate the zone
        # and fetch multi-source evidence before scoring, not just for display)
        lats = [e.lat for e in cluster_events]
        lons = [e.lon for e in cluster_events]
        center_lat = float(np.mean(lats))
        center_lon = float(np.mean(lons))
        dists = [haversine_distance_meters(center_lat, center_lon, e.lat, e.lon) for e in cluster_events]
        radius_m = round(max(dists, default=50.0), 1)

        # Sort top categories by count
        cat_counts = {}
        for e in cluster_events:
            cat_counts[e.category] = cat_counts.get(e.category, 0) + 1
        top_cats = sorted(cat_counts.keys(), key=lambda c: cat_counts[c], reverse=True)
        dominant_category = top_cats[0] if top_cats else None

        # Gather multi-source root-cause evidence for this cluster's area —
        # NOAA (real) + CCTV summary (real, from events already in the
        # cluster) + satellite/mobility/transit (simulated, see evidence_sources.py).
        zone_name = governance.assign_zone(center_lat, center_lon)
        camera_event_count = sum(1 for e in cluster_events if e.evidence_source_type == "cctv_camera")
        evidence_signals = evidence_sources.gather_evidence_for_pattern(
            center_lat, center_lon, zone_name, dominant_category,
            seed_key=f"{cluster_id}:{zone_name}:{dominant_category}",
            camera_event_count=camera_event_count
        )

        # Calculate pattern score & breakdown (now evidence-aware)
        score, score_breakdown = compute_pattern_score(cluster_events, lifts, days_observed, peak_share, evidence_signals)

        # STEP 5: Strict Filtering Rule
        # Score >= MIN_PATTERN_SCORE (50) AND >= 3 distinct categories AND >= 4 independent submitters
        if (score < MIN_PATTERN_SCORE or
            len(distinct_categories) < MIN_DISTINCT_CATEGORIES or
            len(submitter_ids) < MIN_INDEPENDENT_SUBMITTERS):
            logger.info(f"Cluster {cluster_id} rejected by strict filters: score={score}, categories={len(distinct_categories)}, submitters={len(submitter_ids)}")
            continue

        # Build graph
        graph = build_causal_graph(cluster_events)

        # Build timeline (hourly counts)
        timeline_dict = {}
        for e in cluster_events:
            h_key = f"{e.timestamp.hour:02d}:00"
            timeline_dict[h_key] = timeline_dict.get(h_key, 0) + 1

        # Build submitter distribution
        source_dist = {}
        for e in cluster_events:
            source_dist[e.submitter_id] = source_dist.get(e.submitter_id, 0) + 1

        # Generate LLM or Mock explanation, now citing external evidence
        observed_facts, candidate_explanations, recommended_investigation = generate_llm_explanation(
            cluster_events, top_cats, lifts, time_window, days_observed, graph, evidence_signals
        )

        avg_conf = round(float(np.mean([e.confidence for e in cluster_events])), 2)

        pattern_dict = {
            "center_lat": center_lat,
            "center_lon": center_lon,
            "radius_m": radius_m,
            "score": score,
            "score_breakdown": score_breakdown,
            "time_window": time_window,
            "days_observed": days_observed,
            "event_count": len(cluster_events),
            "independent_source_count": len(submitter_ids),
            "top_categories": top_cats,
            "confidence": avg_conf,
            "graph": graph,
            "timeline": timeline_dict,
            "source_distribution": source_dist,
            "observed_facts": observed_facts,
            "candidate_explanations": candidate_explanations,
            "recommended_investigation": recommended_investigation,
            "disclaimer": DISCLAIMER,
            "is_synthetic": any(e.is_synthetic for e in cluster_events),
            "evidence_signals": evidence_signals,
            "cluster_events": cluster_events  # raw events to associate
        }

        detected_patterns.append(pattern_dict)

    return detected_patterns
