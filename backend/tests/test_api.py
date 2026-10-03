from fastapi.testclient import TestClient

from app.data_loader import RunStore
from main import app

client = TestClient(app)


def test_status_and_agent_filters_compose():
    response = client.get(
        "/api/runs?status=failed&agent=kpi-analyst"
    )

    assert response.status_code == 200

    payload = response.json()

    for run in payload["items"]:
        assert run["status"] == "failed"
        assert run["agent"] == "kpi-analyst"


def test_started_at_date_range_filters_runs_inclusively():
    response = client.get(
        "/api/runs?started_at_from=2026-08-01&started_at_to=2026-08-15&limit=500"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert payload["total"] < 200
    assert all(
        "2026-08-01" <= run["started_at"][:10] <= "2026-08-15"
        for run in payload["items"]
    )


def test_tool_filter_matches_runs_with_matching_step():
    response = client.get("/api/runs?tool=vector_search&limit=500")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert all(
        any(step.get("tool") == "vector_search" for step in run["steps"])
        for run in payload["items"]
    )


def test_stats_total_runs():
    response = client.get("/api/stats")

    assert response.status_code == 200

    payload = response.json()

    assert payload["total_runs"] == 200


def test_stats_success_rate_matches_hand_calculation(tmp_path):
    data_path = tmp_path / "runs.jsonl"
    data_path.write_text(
        '{"id":"run-1","agent":"sample","status":"succeeded"}\n'
        '{"id":"run-2","agent":"sample","status":"failed"}\n',
        encoding="utf-8",
    )

    stats = RunStore(data_path).get_stats()

    # One successful run out of two total runs is a 50% success rate.
    assert stats["success_rate"] == 0.5


def test_missing_run_returns_404():
    response = client.get("/api/runs/nonexistent-run-id")

    assert response.status_code == 404


def test_explain_stream_for_run():
    run_id = client.get("/api/runs?limit=1").json()["items"][0]["id"]

    response = client.get(f"/api/runs/{run_id}/explain")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"done": true' in response.text