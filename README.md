# Agent Run Explorer

**A local dashboard for exploring what AI agents did, which tools they used, and how each run performed.**

Instead of grepping through JSONL files, use a searchable run list, inspect each run’s steps, or open the dashboard for an operational overview. The project has two separate services: a Next.js frontend and a FastAPI backend serving the included run dataset.

> **Quick start:** start the backend on `http://localhost:8000`, start the frontend on `http://localhost:3000`, then open [http://localhost:3000/runs](http://localhost:3000/runs).

## Table of contents

- [What you can do](#what-you-can-do)
- [Run it locally](#run-it-locally)
- [Explore the app](#explore-the-app)
- [API reference](#api-reference)
- [Example requests and responses](#example-requests-and-responses)
- [Data and decisions](#data-and-decisions)
- [Run the tests](#run-the-tests)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)

## What you can do

| Area | What it does |
| --- | --- |
| **Runs** | Browse, search, filter, and page through agent runs. Filter by status, agent, tool, or start-date range; search prompts, agent names, and run IDs. |
| **Run details** | Inspect the prompt, status, timing, cost, errors, and ordered execution steps, including each step’s tool, input, output, duration, and token counts when available. |
| **Explain a run** | Request a streamed summary of a run without needing an API key. |
| **Dashboard** | Review overall and per-agent run statistics, durations, costs, and daily run volume. |
| **Shareable views** | List filters and the selected page are reflected in the URL, so you can copy and reopen a view. |
| **Keyboard navigation** | Move the selected run with the arrow keys and open it with Enter. |
| **Step deep links** | Open a particular step directly with a URL fragment such as `/runs/run_0042#step-3`. |

## Run it locally

You’ll need **Python 3.12 or newer**, **Node.js 18 or newer**, and **npm**. No database or API key is required. Run the backend and frontend in **two separate terminals**, starting both from the repository root.

### Windows PowerShell

**Terminal 1 — backend**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend**

```powershell
Set-Location frontend
npm install
Copy-Item ..\.env.example .env.local
npm run dev
```

### macOS or Linux

**Terminal 1 — backend**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
cp ../.env.example .env.local
npm run dev
```

When both services are running, visit:

| Address | What you’ll find |
| --- | --- |
| [http://localhost:3000/runs](http://localhost:3000/runs) | Searchable run explorer |
| [http://localhost:3000/dashboard](http://localhost:3000/dashboard) | Dashboard |
| [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive FastAPI documentation |
| [http://localhost:8000/health](http://localhost:8000/health) | Backend health check |

The frontend reads `NEXT_PUBLIC_API_BASE_URL` from `frontend/.env.local`; it defaults to `http://localhost:8000`. Change it if your backend is listening at a different address, then restart the frontend dev server.

## Explore the app

### Runs list

The list shows 25 runs per page. Use the controls to filter by status, agent, or tool, and to search by prompt text, agent name, or run ID. The page number and applied filters are stored in the URL. An on-page request counter and latest request duration show list-fetch activity.

| Key | Action |
| --- | --- |
| `↓` / `↑` | Move the highlight down or up the visible run list |
| `Enter` | Open the highlighted run |

Keyboard navigation is paused while focus is in an input, select, button, link, or editable area.

### Run details

Select a run ID to see its prompt and metadata. Expand a step to inspect its input and output without leaving the page. If a step has tool, status, duration, or token information, that appears alongside its name. Use **Run explanation** to receive the explanation as a stream rather than waiting for a single completed response.

To link directly to a step, append its one-based number as a fragment: `/runs/run_0042#step-3`.

### Dashboard

The dashboard shows overall run and status counts, success rates by agent, duration summaries, cost totals per agent, and daily run counts. Its statistics are global to the dataset; they do not change with the filters on the runs page.

## API reference

The backend runs separately from Next.js. Use `http://localhost:8000` as the base URL when calling it directly. The routes and parameters below describe the **current implementation**. The assignment contract and current implementation differ in several places; those gaps are called out after the reference.

| Method and path | Purpose | Typical response |
| --- | --- | --- |
| `GET /health` | Check that the service is up. | `{"status":"ok"}` |
| `GET /api/runs` | Return a page of runs. Query parameters include `status`, `agent`, `tool`, `started_at_from`, `started_at_to`, `q`, `sort`, `order`, `limit`, and `offset`. | An object with `total` and an `items` array. Current items include `steps`. |
| `GET /api/runs/{run_id}` | Return one run, including its steps. | A run record; `404` if the ID is unknown. |
| `GET /api/stats` | Return global dashboard aggregates. | Run counts, success rates, duration summary, cost totals, and daily counts. |
| `GET /api/runs/{run_id}/explain` | Stream a basic run summary as Server-Sent Events (SSE). | `text/event-stream`; `404` if the ID is unknown. |

The assignment requires `POST /api/runs/{id}/explain` with a mock provider. That required method/provider are **not implemented**: the current backend exposes the `GET` route above and directly streams a basic summary. No API key is needed for the current summary stream.

### Current run-list query parameters

| Parameter | Behavior |
| --- | --- |
| `status` | Exact match on status; repeat the parameter for multiple statuses. |
| `agent` | Case-insensitive partial match on agent name; repeat the parameter for multiple names. |
| `tool` | Match runs with a step using a supplied tool name; repeat the parameter or give comma-separated names. |
| `started_at_from` | Include runs started on or after this date (`YYYY-MM-DD`). |
| `started_at_to` | Include runs started on or before this date (`YYYY-MM-DD`). |
| `q` | Case-insensitive search across prompt, agent name, and run ID. |
| `sort` | Sort key. The intended values are `started_at`, `duration_ms`, and `cost_usd`. |
| `order` | `asc` or `desc`; defaults to `desc`. |
| `limit` | Page size; defaults to `50`, maximum `500`. |
| `offset` | Number of matching runs to skip; defaults to `0`. |

The current API composes these filters in a single request. The date range is inclusive; either bound may be used on its own. If both are provided, `started_at_from` must be on or before `started_at_to`. The UI keeps the dates in the URL so the filtered view can be shared.

### Required list response shape

The assignment requires list items to omit `steps`. This is the required compact shape, **not the current backend response**:

```json
{
  "total": 1,
  "items": [
    {
      "id": "run_0042",
      "agent": "example-agent",
      "status": "succeeded",
      "prompt": "Summarize the latest report",
      "error": null,
      "started_at": "2025-01-15T10:30:00+00:00",
      "ended_at": "2025-01-15T10:30:04+00:00",
      "duration_ms": 4000,
      "cost_usd": 0.02
    }
  ]
}
```

**Current behavior differs:** the backend serializes each item with its full `steps` array. The list endpoint should be changed to omit steps to meet the assignment.

### Statistics response

`GET /api/stats` computes aggregates in the backend and returns fields in this shape:

```json
{
  "total_runs": 200,
  "success_rate": 0.75,
  "status_counts": { "failed": 41, "succeeded": 150, "running": 9 },
  "by_agent": {
    "example-agent": { "runs": 10, "success_rate": 0.8 }
  },
  "cost_by_agent": { "example-agent": 1.25 },
  "daily_counts": { "2025-01-15": 3 },
  "duration_summary": {
    "count": 180,
    "median_ms": 1200,
    "p95_ms": 5000,
    "average_ms": 1600.5
  }
}
```

Values above illustrate the response shape; actual values depend on the data. Success rates are fractions from `0` to `1`. Currently, the overall denominator includes all runs, including running ones, and duration statistics include every run with a recorded duration; they are not limited to completed runs as the assignment requires. Daily counts include every date between the earliest and latest recorded start dates, filling days with no runs as zero.

## Example requests and responses

Run these from a terminal while the backend is running. On Windows, use `curl.exe` in PowerShell.

**Get the first 10 runs**

```bash
curl "http://localhost:8000/api/runs?limit=10"
```

**Combine supported filters and sort by cost**

```bash
curl "http://localhost:8000/api/runs?status=failed&agent=kpi&agent=research&started_at_from=2026-08-01&started_at_to=2026-08-15&tool=vector_search&q=report&sort=cost_usd&order=desc&limit=25&offset=0"
```

**Filter runs by start date**

```bash
curl "http://localhost:8000/api/runs?started_at_from=2026-08-01&started_at_to=2026-08-15"
```

**Get dashboard statistics**

```bash
curl "http://localhost:8000/api/stats"
```

**Get one run and stream its explanation**

```bash
curl "http://localhost:8000/api/runs/run_0042"
curl -N "http://localhost:8000/api/runs/run_0042/explain"
```

The second request uses the current `GET` route and returns a progressively streamed SSE response. It needs no API key. It is a basic summary stream, not the assignment’s required `POST` route or configurable mock-provider implementation.

## Data and decisions

The backend loads [`data/runs.jsonl`](./data/runs.jsonl) into memory at startup. It normalizes records, skips malformed JSON lines, and keeps the more complete record when duplicate IDs occur. Missing costs stay unpriced rather than being treated as zero; see [`DECISIONS.md`](./DECISIONS.md) for the project’s data-handling and metric decisions.

The included dataset contains **200 unique runs** after duplicate IDs are resolved. Dashboard statistics are global, not affected by the runs page’s current filters.

## Run the tests

From the repository root:

**Windows PowerShell**

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q
```

**macOS or Linux**

```bash
cd backend
../.venv/bin/python -m pytest -q
```

The backend tests cover composed filters, tool filtering, statistics, missing-run `404`s, and the explain stream.

## Project layout

| Path | Contents |
| --- | --- |
| `backend/main.py` | FastAPI routes and SSE explanation endpoint |
| `backend/app/data_loader.py` | JSONL loading, normalization, filtering, and aggregates |
| `backend/tests/test_api.py` | Backend API tests |
| `frontend/app/runs/` | Run list and run detail pages |
| `frontend/app/dashboard/` | Dashboard page |
| `data/runs.jsonl` | Included run dataset |
| `DECISIONS.md` | Data and implementation decisions |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Frontend says it cannot load runs or dashboard data | Make sure the backend terminal is still running on port `8000`. |
| Port `3000` or `8000` is already in use | Stop the other process or choose a different port; if the backend port changes, update `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local`. |
| Python dependency or command not found | Confirm Python 3.12+ is installed and that you ran the setup commands from the repository root. |
| The page loads but has no matching rows | Clear the list filters or try a broader search. |
