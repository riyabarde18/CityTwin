import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_all_tests():
    print("==================================================")
    print("RUNNING CITYTWIN BACKEND ENDPOINT INTEGRATION TESTS")
    print("==================================================")

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    assert health_data["mock_mode"] == False, "Expected Gemini connected (mock_mode=False)"
    print(f"[PASS] GET /api/health -> {health_data}")

    # 2. Seed Data
    res = client.post("/api/seed")
    assert res.status_code == 200, f"Seed failed: {res.text}"
    seed_data = res.json()
    assert seed_data["events_created"] > 50
    print(f"[PASS] POST /api/seed -> Seeded {seed_data['events_created']} synthetic events")

    # 3. Get Events
    res = client.get("/api/events?period=before")
    assert res.status_code == 200, f"Get events failed: {res.text}"
    events = res.json()
    assert len(events) == seed_data["events_created"]
    print(f"[PASS] GET /api/events -> Retrieved {len(events)} events")

    # 4. Analyze Patterns
    res = client.post("/api/analyze")
    assert res.status_code == 200, f"Analyze failed: {res.text}"
    patterns = res.json()
    assert len(patterns) == 1, f"Expected exactly 1 pattern, got {len(patterns)}"
    hotspot_pattern = patterns[0]
    print(f"[PASS] POST /api/analyze -> Detected {len(patterns)} pattern(s). Hotspot score: {hotspot_pattern['score']}")
    print(f"       Top categories in hotspot: {hotspot_pattern['top_categories']}")

    # 5. List Patterns
    res = client.get("/api/patterns")
    assert res.status_code == 200, f"List patterns failed: {res.text}"
    pattern_list = res.json()
    assert len(pattern_list) == 1
    print(f"[PASS] GET /api/patterns -> Returned {len(pattern_list)} pattern summaries")

    # 6. Pattern Detail
    pattern_id = hotspot_pattern["id"]
    res = client.get(f"/api/patterns/{pattern_id}")
    assert res.status_code == 200, f"Pattern detail failed: {res.text}"
    detail = res.json()
    assert detail["id"] == pattern_id
    assert "score_breakdown" in detail
    assert "graph" in detail
    assert "candidate_explanations" in detail
    assert "disclaimer" in detail
    print(f"[PASS] GET /api/patterns/{{id}} -> Retrieved pattern detail with {len(detail['events'])} evidence events")
    print(f"       Score Breakdown: {detail['score_breakdown']}")
    print(f"       Graph nodes count: {len(detail['graph']['nodes'])}, edges count: {len(detail['graph']['edges'])}")

    # 7. Post New Observation
    obs_payload = {
        "text": "Pothole damaged surface on street with standing water near crosswalk",
        "lat": 37.7750,
        "lon": -122.4195,
        "submitter_id": "test_reporter_999",
        "road_segment_id": "SEG_TEST_101"
    }
    res = client.post("/api/observations", data=obs_payload)
    assert res.status_code == 200, f"Create observation failed: {res.text}"
    new_obs_events = res.json()
    assert len(new_obs_events) >= 1
    print(f"[PASS] POST /api/observations -> Created {len(new_obs_events)} events from perception input")

    # 8. Simulate Intervention
    res = client.post("/api/interventions/simulate", json={"pattern_id": pattern_id})
    assert res.status_code == 200, f"Intervention simulation failed: {res.text}"
    sim_data = res.json()
    assert sim_data["overall_reduction_pct"] > 50.0
    print(f"[PASS] POST /api/interventions/simulate -> Overall reduction: {sim_data['overall_reduction_pct']}%")

    print("\n==================================================")
    print("ALL BACKEND ENDPOINT INTEGRATION TESTS PASSED! SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_all_tests()
