from __future__ import annotations

from datetime import date
import json
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.data_loader import RunStore
from app.explain_provider import ExplainProvider, MockExplainProvider

app = FastAPI(title="Run Explorer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = RunStore()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/runs")
def list_runs(
    status: list[str] | None = Query(default=None),
    agent: list[str] | None = Query(default=None),
    tool: list[str] | None = Query(default=None),
    started_at_from: date | None = Query(default=None),
    started_at_to: date | None = Query(default=None),
    q: str | None = Query(default=None),
    sort: str = Query(default="started_at"),
    order: str = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    if started_at_from and started_at_to and started_at_from > started_at_to:
        raise HTTPException(
            status_code=422,
            detail="started_at_from must be on or before started_at_to",
        )

    return store.list_runs(
        status=status,
        agent=agent,
        tool=tool,
        started_at_from=started_at_from,
        started_at_to=started_at_to,
        q=q,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/stats")
def get_stats():
    return store.get_stats()


def get_explain_provider() -> ExplainProvider:
    provider_name = os.getenv("EXPLAIN_PROVIDER", "mock").strip().lower()
    if provider_name == "mock":
        return MockExplainProvider()
    raise HTTPException(
        status_code=500,
        detail=f"Unsupported EXPLAIN_PROVIDER: {provider_name}",
    )


@app.get("/api/runs/{run_id}/explain")
@app.post("/api/runs/{run_id}/explain")
async def explain_run(run_id: str):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    provider = get_explain_provider()

    async def stream():
        async for message in provider.stream(run):
            payload = {"message": message}
            yield f"data: {json.dumps(payload)}\n\n"

        final_payload = {"done": True, "run_id": run_id}
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.exception_handler(404)
async def not_found_handler(_, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})
