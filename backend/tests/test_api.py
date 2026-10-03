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
    assert all("steps" not in run for run in payload["items"])

    detail = client.get(f"/api/runs/{payload['items'][0]['id']}")
    assert detail.status_code == 200
    assert any(step.get("tool") == "vector_search" for step in detail.json()["steps"])


def test_run_detail_includes_steps():
    list_response = client.get("/api/runs?limit=1")
    run_id = list_response.json()["items"][0]["id"]

    detail_response = client.get(f"/api/runs/{run_id}")

    assert detail_response.status_code == 200
    assert "steps" in detail_response.json()


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


def test_duration_stats_only_include_completed_runs(tmp_path):
    data_path = tmp_path / "runs.jsonl"
    data_path.write_text(
        '{"id":"success","agent":"sample","status":"succeeded","duration_ms":100}\n'
        '{"id":"failure","agent":"sample","status":"failed","duration_ms":200}\n'
        '{"id":"cancelled","agent":"sample","status":"cancelled","duration_ms":300}\n'
        '{"id":"running","agent":"sample","status":"running","duration_ms":10000}\n',
        encoding="utf-8",
    )

    duration_summary = RunStore(data_path).get_stats()["duration_summary"]

    assert duration_summary["count"] == 3
    assert duration_summary["median_ms"] == 200
    assert duration_summary["p95_ms"] == 300


def test_run_sort_supports_ascending_and_descending(tmp_path):
    data_path = tmp_path / "runs.jsonl"
    data_path.write_text(
        '{"id":"low","agent":"sample","status":"succeeded","cost_usd":0.1}\n'
        '{"id":"middle","agent":"sample","status":"succeeded","cost_usd":0.2}\n'
        '{"id":"high","agent":"sample","status":"succeeded","cost_usd":0.3}\n',
        encoding="utf-8",
    )
    store = RunStore(data_path)

    ascending = store.list_runs(sort="cost_usd", order="asc", limit=10)
    descending = store.list_runs(sort="cost_usd", order="desc", limit=10)

    assert [run["id"] for run in ascending["items"]] == ["low", "middle", "high"]
    assert [run["id"] for run in descending["items"]] == ["high", "middle", "low"]


def test_missing_run_returns_404():
    response = client.get("/api/runs/nonexistent-run-id")

    assert response.status_code == 404


def test_post_explain_stream_uses_mock_provider(monkeypatch):
    monkeypatch.setenv("EXPLAIN_PROVIDER", "mock")
    run_id = client.get("/api/runs?status=failed&limit=1").json()["items"][0]["id"]

    response = client.post(f"/api/runs/{run_id}/explain")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"message":' in response.text
    assert "Error:" in response.text
    assert '"done": true' in response.text


def test_get_explain_stream_can_be_opened_in_browser(monkeypatch):
    monkeypatch.setenv("EXPLAIN_PROVIDER", "mock")
    run_id = client.get("/api/runs?limit=1").json()["items"][0]["id"]

    response = client.get(f"/api/runs/{run_id}/explain")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"done": true' in response.text