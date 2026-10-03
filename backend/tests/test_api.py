from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_runs_list_has_items():
    response = client.get("/api/runs?limit=5")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] > 0
    assert len(payload["items"]) > 0


def test_runs_detail_endpoint():
    response = client.get("/api/runs")
    first_id = response.json()["items"][0]["id"]
    detail = client.get(f"/api/runs/{first_id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == first_id


def test_stats_endpoint():
    response = client.get("/api/stats")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_runs"] > 0
    assert "success_rate" in payload
    assert "by_agent" in payload


def test_explain_stream_returns_data():
    run_id = client.get("/api/runs?limit=1").json()["items"][0]["id"]
    response = client.get(f"/api/explain?run_id={run_id}")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    text = response.text
    assert "Analyzing run" in text or "done" in text.lower()
