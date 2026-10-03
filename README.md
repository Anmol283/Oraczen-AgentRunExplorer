# Agent Run Explorer

A small web app for browsing and understanding agent execution traces from a messy production-like JSONL dataset.

This project is intentionally built around real-world data quality issues, so the backend validates and normalizes the rows instead of trusting the input blindly.

## What the app does

- Lists agent runs from the dataset in a searchable, filterable table
- Shows run details, prompts, steps, latency, cost, and errors
- Exposes dashboard statistics such as total runs, success rate, cost per agent, and daily counts
- Streams a simple natural-language explanation for a chosen run
- Keeps the frontend and backend as separate processes communicating over HTTP

## Stack

- Python 3.12+
- FastAPI for the API layer
- Next.js + TypeScript + React for the frontend
- Data source: data/runs.jsonl

## Project structure

- backend/ — FastAPI service and API logic
- backend/app/data_loader.py — JSONL loading, normalization, filtering, and aggregates
- backend/main.py — HTTP endpoints
- backend/tests/test_api.py — API test coverage
- frontend/ — Next.js app
- frontend/app/ — routes for /runs, /runs/[id], and /dashboard
- data/runs.jsonl — source dataset
- .env.example — example environment values
- DECISIONS.md — required decisions about the messy data

## Data source and handling

The app reads all records directly from data/runs.jsonl at startup. No database is required.

The dataset is intentionally imperfect. The loader handles these real production-style issues:

- duplicate run IDs
- missing or null cost values
- running jobs with no end time or duration
- a negative duration value
- empty or malformed step arrays
- malformed JSON lines

The backend keeps the most complete duplicate record and skips malformed rows cleanly rather than silently returning bad data.

## Local setup

Prerequisites:

- Python 3.12+
- Node.js 18+
- npm

From the repo root:

1. Install backend dependencies:

   cd backend
   C:/Users/VICTUS/AppData/Local/Programs/Python/Python312/python.exe -m pip install -r requirements.txt

2. Start the API service:

   cd backend
   C:/Users/VICTUS/AppData/Local/Programs/Python/Python312/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

3. In a second terminal, install frontend dependencies:

   cd frontend
   npm install

4. Start the Next.js app:

   cd frontend
   npm run dev

5. Open the app in the browser:

   http://localhost:3000/runs
   http://localhost:3000/dashboard

## Environment variables

The app expects the frontend to know where the backend lives. Copy the example file and adjust if needed:

cp .env.example .env.local

Example:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

## API endpoints

### GET /api/runs
Returns a paginated list of runs with filtering and sorting.

Query parameters:

- status: repeated values or comma-separated values
- agent: repeated values or comma-separated values
- q: free-text prompt search
- sort: started_at, duration_ms, or cost_usd
- order: asc or desc
- limit: page size
- offset: pagination offset

### GET /api/runs/{id}
Returns one run including its steps and metadata.

### GET /api/stats
Returns aggregate dashboard data:

- total run count
- overall success rate
- success rate per agent
- median and p95 duration values
- total cost per agent
- run counts per day

### GET /api/explain?run_id=...
Streams a simple explanation for one run as a Server-Sent Events stream.

The explanation endpoint works without a real API key and uses a deterministic mock provider for testing and local development.

## Frontend routes

- /runs — searchable, filterable list of runs with URL-based query state
- /runs/[id] — detailed single-run view with explain stream
- /dashboard — summary metrics and charts

## Tests

Backend tests are included in backend/tests/test_api.py.

Run them with:

cd backend
C:/Users/VICTUS/AppData/Local/Programs/Python/Python312/python.exe -m pytest -q

These tests cover:

- health check
- list endpoint behavior
- run detail retrieval
- stats endpoint
- explain stream response

## Decisions and data notes

The required decision notes are documented in DECISIONS.md. They cover:

- how null costs are treated
- how running jobs are counted
- how the messy data is handled
- whether the dashboard stats are global or filtered

## Notes for a fresh clone

- No manual import step is required.
- The backend loads the dataset from data/runs.jsonl automatically on startup.
- If the frontend is stuck on a loading screen, the usual cause is that the API service is not running on port 8000.

## Submission-ready checklist

This project includes:

- working backend API
- working Next.js frontend
- data loaded from JSONL instead of manual seeding
- env example file
- documentation in README.md
- decisions document covering the messy data questions
