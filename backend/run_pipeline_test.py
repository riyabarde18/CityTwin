import sys
import json
from pathlib import Path

# Force reloading config and modules
if "config" in sys.modules:
    del sys.modules["config"]
if "main" in sys.modules:
    del sys.modules["main"]

from fastapi.testclient import TestClient
import config
from main import app

client = TestClient(app)

def main():
    print("--------------------------------------------------")
    print(f"DEBUG: GEMINI_API_KEY loaded: {config.GEMINI_API_KEY[:10]}...")
    print(f"DEBUG: IS_MOCK_MODE: {config.IS_MOCK_MODE}")
    print("--------------------------------------------------")

    # Step 1: GET /api/health
    res1 = client.get("/api/health")
    print("1. GET /api/health Response:")
    print(json.dumps(res1.json(), indent=2))
    health_data = res1.json()
    assert health_data["status"] == "ok"
    assert health_data["mock_mode"] == False, f"Expected mock_mode=False, got {health_data['mock_mode']}"

    # Step 2: POST /api/seed
    res2 = client.post("/api/seed")
    print("\n2. POST /api/seed Response:")
    print(json.dumps(res2.json(), indent=2))
    seed_data = res2.json()
    assert seed_data["status"] == "ok"

    # Step 3: POST /api/analyze
    res3 = client.post("/api/analyze")
    print("\n3. POST /api/analyze Response:")
    print(json.dumps(res3.json(), indent=2))
    patterns_analyzed = res3.json()

    # Step 4: GET /api/patterns
    res4 = client.get("/api/patterns")
    print("\n4. GET /api/patterns Response:")
    print(json.dumps(res4.json(), indent=2))
    pattern_list = res4.json()

    print("\n--------------------------------------------------")
    print(f"TOTAL PATTERNS FOUND: {len(pattern_list)}")
    print("--------------------------------------------------")
    assert len(pattern_list) == 1, f"Expected exactly 1 pattern, found {len(pattern_list)}"
    p = pattern_list[0]
    print(f"Pattern ID: {p['id']}")
    print(f"Center: {p['center']}")
    print(f"Score: {p['score']}")
    print(f"Top Categories: {p['top_categories']}")
    print(f"Event Count: {p['event_count']}")
    print(f"Independent Sources: {p['independent_source_count']}")

if __name__ == "__main__":
    main()
