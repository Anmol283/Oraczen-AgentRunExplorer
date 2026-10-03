from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.data_loader import RunStore

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
    q: str | None = Query(default=None),
    sort: str = Query(default="started_at"),
    order: str = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return store.list_runs(
        status=status,
        agent=agent,
        tool=tool,
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


@app.get("/api/explain")
@app.get("/api/runs/{run_id}/explain")
async def explain_run(run_id: str):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    async def stream():
        import asyncio
        import json

        summary = [
            f"Analyzing run {run['id']} for agent {run['agent']}.",
            f"Status: {run['status']}.",
            f"Started at {run['started_at']} and ended at {run['ended_at'] or 'not yet'}.",
            f"Duration was {run['duration_ms']} ms with cost {run['cost_usd'] if run['cost_usd'] is not None else 'not recorded'}.",
            f"This run had {len(run.get('steps') or [])} recorded steps.",
        ]

        for message in summary:
            payload = {"message": message}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.05)

        for idx, step in enumerate(run.get("steps") or [], start=1):
            step_name = step.get("name") if isinstance(step, dict) else str(step)
            detail = step.get("status") if isinstance(step, dict) else "step"
            payload = {"step": idx, "name": step_name, "status": detail}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.05)

        final_payload = {"done": True, "run_id": run_id}
        yield f"data: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.exception_handler(404)
async def not_found_handler(_, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})
