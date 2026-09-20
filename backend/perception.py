import hashlib
import json
import logging
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field
from PIL import Image
import io

from config import GEMINI_API_KEY, IS_MOCK_MODE, CATEGORIES

logger = logging.getLogger(__name__)

class PerceptionEvent(BaseModel):
    category: str = Field(..., description="Must be one of the fixed categories")
    severity: int = Field(..., ge=1, le=5, description="Severity from 1 to 5")
    detected_objects: List[str] = Field(default_factory=list, description="List of detected object labels")
    time_clue: Optional[str] = Field(None, description="Time of day clue if visible/mentioned")
    short_description: str = Field(..., description="Brief summary of observed issue")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")

class PerceptionResponse(BaseModel):
    events: List[PerceptionEvent]

def compute_image_hash(image_bytes: bytes) -> str:
    """Computes a SHA256 hash of image bytes for duplicate detection."""
    if not image_bytes:
        return ""
    return hashlib.sha256(image_bytes).hexdigest()

def mock_perception_extract(text: Optional[str], image_provided: bool = False) -> List[PerceptionEvent]:
    """Fallback keyword-based mock perception engine."""
    events = []
    text_lower = (text or "").lower()

    # Keyword mapping to category and metadata
    keyword_map = [
        (["water", "puddle", "flood", "drain", "standing water", "overflow"], "standing_water", 4, ["water_puddle", "clogged_drain"], "Standing water accumulating on street/path"),
        (["block", "obstruct", "footpath", "sidewalk", "vendor", "scooter", "barrier", "parked vehicle"], "footpath_obstruction", 3, ["illegal_stall", "parked_scooter"], "Pedestrian path blocked by obstruction"),
        (["pedestrian", "walking on road", "people in street", "forced onto road"], "pedestrian_on_road", 4, ["pedestrians", "traffic_lane"], "Pedestrians forced to walk on active vehicle lane"),
        (["traffic", "jam", "slowdown", "vehicles stopped", "queue", "congestion"], "traffic_slowdown", 3, ["queued_cars", "brake_lights"], "Vehicle traffic slowdown/congestion"),
        (["pothole", "damaged", "cracked", "asphalt", "surface", "broken road"], "damaged_surface", 4, ["pothole", "cracked_pavement"], "Damaged surface with road hazards"),
        (["garbage", "trash", "waste", "litter", "overflowing bin", "dump"], "garbage", 2, ["trash_bags", "litter"], "Accumulated garbage/waste overflow"),
        (["cross", "crossing", "signal", "unsafe cross", "no crosswalk"], "unsafe_crossing", 4, ["unmarked_crosswalk", "pedestrians"], "Unsafe pedestrian crossing condition"),
        (["wheelchair", "ramp", "accessibility", "handicap", "stair barrier"], "accessibility_barrier", 3, ["high_curb", "missing_ramp"], "Accessibility barrier for wheelchair/disabled users")
    ]

    found_categories = set()
    for keywords, cat, default_sev, objects, desc in keyword_map:
        if any(kw in text_lower for kw in keywords):
            found_categories.add(cat)
            events.append(PerceptionEvent(
                category=cat,
                severity=default_sev,
                detected_objects=objects,
                time_clue="daytime" if "day" in text_lower else None,
                short_description=desc,
                confidence=0.92
            ))

    if not events:
        # Default fallback event if no keyword matched
        desc = text if text else ("Observed photo report" if image_provided else "General urban observation report")
        events.append(PerceptionEvent(
            category="footpath_obstruction",
            severity=3,
            detected_objects=["unspecified_hazard"],
            time_clue=None,
            short_description=desc[:150],
            confidence=0.85
        ))

    return events

def run_perception(
    text: Optional[str] = None,
    image_bytes: Optional[bytes] = None
) -> List[PerceptionEvent]:
    """Runs Gemini Vision/Text perception, falling back to mock perception if API unavailable."""
    if IS_MOCK_MODE or not GEMINI_API_KEY:
        logger.info("Using MOCK Perception mode")
        return mock_perception_extract(text, image_provided=bool(image_bytes))

    try:
        from google import genai
        from google.genai import types

        # Timeout caps each attempt so a quota 429 or slow network can't
        # hang this request for minutes (the SDK's built-in retry/backoff
        # otherwise waits out the server's suggested retry-after).
        client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=12_000)  # milliseconds
        )

        prompt = (
            f"You are an urban perception AI analyzer. Analyze the provided report (text and/or image).\n"
            f"Extract all detected urban infrastructure problems. You MUST ONLY categorize each event using one of these exact allowed categories: {json.dumps(CATEGORIES)}.\n"
            f"One observation may yield multiple events if distinct problems are visible/described.\n"
            f"Additional text report: {text or 'None'}"
        )

        contents = []
        if image_bytes:
            try:
                img = Image.open(io.BytesIO(image_bytes))
                contents.append(img)
            except Exception as e:
                logger.warning(f"Failed to open image for Gemini: {e}")

        contents.append(prompt)

        models_to_try = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=PerceptionResponse,
                        temperature=0.2,
                    ),
                )

                if response and response.text:
                    parsed = PerceptionResponse.model_validate_json(response.text)
                    sanitized_events = []
                    for ev in parsed.events:
                        if ev.category in CATEGORIES:
                            sanitized_events.append(ev)
                        else:
                            ev.category = "footpath_obstruction"
                            sanitized_events.append(ev)
                    if sanitized_events:
                        return sanitized_events
            except Exception as err:
                logger.warning(f"Gemini perception with {model_name} failed: {err}")
                continue

    except Exception as e:
        logger.warning(f"Gemini perception setup failed, falling back to MOCK mode: {e}")

    return mock_perception_extract(text, image_provided=bool(image_bytes))
