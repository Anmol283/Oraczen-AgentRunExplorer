from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from math import ceil
from pathlib import Path
from statistics import median
from typing import Any, Iterable

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "runs.jsonl"


class RunStore:
    def __init__(self, data_path: str | Path = DATA_PATH):
        self.data_path = Path(data_path)
        self.runs = self._load_runs()

    def _load_runs(self) -> dict[str, dict[str, Any]]:
        runs: dict[str, dict[str, Any]] = {}
        if not self.data_path.exists():
            return runs

        with self.data_path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    print(f"Skipping invalid JSON at line {line_number}: {exc}")
                    continue

                normalized = self._normalize_record(record)
                if normalized is None:
                    continue

                run_id = normalized["id"]
                existing = runs.get(run_id)
                if existing is None:
                    runs[run_id] = normalized
                    continue

                if self._is_better_record(normalized, existing):
                    runs[run_id] = normalized

        return runs

    def _normalize_record(self, record: Any) -> dict[str, Any] | None:
        if not isinstance(record, dict):
            return None

        raw_id = record.get("id")
        if raw_id is None:
            return None

        run_id = str(raw_id).strip()
        if not run_id:
            return None

        agent = str(record.get("agent") or "unknown").strip() or "unknown"
        status = str(record.get("status") or "unknown").strip().lower() or "unknown"
        prompt = str(record.get("prompt") or "").strip()
        error = record.get("error")
        if error is not None:
            error = str(error).strip() or None

        started_at = self._coerce_datetime(record.get("started_at"))
        ended_at = self._coerce_datetime(record.get("ended_at"))

        duration_ms = self._coerce_number(record.get("duration_ms"))
        if duration_ms is not None and duration_ms < 0:
            duration_ms = None

        cost_usd = self._coerce_number(record.get("cost_usd"))
        if cost_usd is not None and cost_usd < 0:
            cost_usd = None

        steps = record.get("steps")
        if not isinstance(steps, list):
            steps = []

        return {
            "id": run_id,
            "agent": agent,
            "status": status,
            "prompt": prompt,
            "error": error,
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "steps": steps,
        }

    @staticmethod
    def _coerce_datetime(value: Any) -> str | None:
        if value in (None, ""):
            return None

        if isinstance(value, datetime):
            return value.isoformat()

        text = str(value).strip()
        if not text:
            return None

        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

        return parsed.isoformat()

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        if value in (None, ""):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number

    @staticmethod
    def _is_better_record(candidate: dict[str, Any], current: dict[str, Any]) -> bool:
        scoring = {
            "started_at": 1 if candidate.get("started_at") else 0,
            "ended_at": 1 if candidate.get("ended_at") else 0,
            "duration_ms": 1 if candidate.get("duration_ms") is not None else 0,
            "cost_usd": 1 if candidate.get("cost_usd") is not None else 0,
            "error": 1 if candidate.get("error") else 0,
            "steps": 1 if candidate.get("steps") else 0,
        }
        current_score = sum(
            [
                1 if current.get("started_at") else 0,
                1 if current.get("ended_at") else 0,
                1 if current.get("duration_ms") is not None else 0,
                1 if current.get("cost_usd") is not None else 0,
                1 if current.get("error") else 0,
                1 if current.get("steps") else 0,
            ]
        )
        candidate_score = sum(scoring.values())
        if candidate_score != current_score:
            return candidate_score > current_score
        return candidate.get("started_at") or "" >= current.get("started_at") or ""

    def list_runs(
        self,
        status: list[str] | None = None,
        agent: list[str] | None = None,
        q: str | None = None,
        sort: str = "started_at",
        order: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        filtered = list(self.runs.values())

        status_values = {value.lower() for value in (status or [])}
        if status_values:
            filtered = [run for run in filtered if run["status"].lower() in status_values]

        agent_values = {value.lower() for value in (agent or [])}
        if agent_values:
            filtered = [run for run in filtered if run["agent"].lower() in agent_values]

        if q:
            query = q.lower().strip()
            filtered = [
                run
                for run in filtered
                if query in run.get("prompt", "").lower()
                or query in run.get("agent", "").lower()
                or query in run.get("id", "").lower()
            ]

        filtered = self._sort_runs(filtered, sort=sort, order=order)
        total = len(filtered)
        page = filtered[offset : offset + limit]
        return {"total": total, "items": [self._serialize_run(run) for run in page]}

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        run = self.runs.get(run_id)
        if run is None:
            return None
        return self._serialize_run(run)

    def get_stats(self) -> dict[str, Any]:
        runs = list(self.runs.values())
        total_runs = len(runs)
        if total_runs == 0:
            return {
                "total_runs": 0,
                "success_rate": 0.0,
                "status_counts": {},
                "by_agent": {},
                "cost_by_agent": {},
                "daily_counts": {},
                "duration_summary": {},
            }

        status_counts = Counter(run["status"] for run in runs)
        success_count = status_counts.get("succeeded", 0)
        success_rate = round(success_count / total_runs, 4) if total_runs else 0.0

        by_agent: dict[str, dict[str, Any]] = {}
        agent_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for run in runs:
            agent_groups[run["agent"]].append(run)

        for agent, agent_runs in sorted(agent_groups.items()):
            agent_total = len(agent_runs)
            agent_success = sum(1 for run in agent_runs if run["status"] == "succeeded")
            by_agent[agent] = {
                "runs": agent_total,
                "success_rate": round(agent_success / agent_total, 4) if agent_total else 0.0,
            }

        duration_values = [run["duration_ms"] for run in runs if run["duration_ms"] is not None]
        duration_summary = {
            "count": len(duration_values),
            "median_ms": int(median(duration_values)) if duration_values else None,
            "p95_ms": self._percentile(duration_values, 95),
            "average_ms": round(sum(duration_values) / len(duration_values), 2) if duration_values else None,
        }

        cost_by_agent = {}
        for agent, agent_runs in sorted(agent_groups.items()):
            cost_total = sum(
                run["cost_usd"] for run in agent_runs if run["cost_usd"] is not None
            )
            cost_by_agent[agent] = round(cost_total, 2)

        daily_counts: dict[str, int] = {}
        for run in runs:
            if run["started_at"] is None:
                continue
            day = run["started_at"][:10]
            daily_counts[day] = daily_counts.get(day, 0) + 1

        if daily_counts:
            start_day = min(daily_counts)
            end_day = max(daily_counts)
            current = datetime.fromisoformat(start_day)
            last = datetime.fromisoformat(end_day)
            while current <= last:
                day_key = current.date().isoformat()
                daily_counts.setdefault(day_key, 0)
                current += timedelta(days=1)

        return {
            "total_runs": total_runs,
            "success_rate": success_rate,
            "status_counts": dict(sorted(status_counts.items())),
            "by_agent": dict(sorted(by_agent.items())),
            "cost_by_agent": dict(sorted(cost_by_agent.items())),
            "daily_counts": dict(sorted(daily_counts.items())),
            "duration_summary": duration_summary,
        }

    @staticmethod
    def _sort_runs(runs: Iterable[dict[str, Any]], sort: str, order: str) -> list[dict[str, Any]]:
        sort_key = sort.lower()

        def sort_value(run: dict[str, Any]) -> tuple[Any, Any]:
            value = run.get(sort_key)
            if value is None:
                return (1, 0)
            if sort_key in {"duration_ms", "cost_usd"}:
                return (0, float(value))
            if sort_key == "started_at":
                return (0, value)
            return (0, str(value).lower())

        ordered = sorted(runs, key=sort_value)
        if order.lower() == "desc":
            ordered.reverse()
        return ordered

    @staticmethod
    def _serialize_run(run: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": run["id"],
            "agent": run["agent"],
            "status": run["status"],
            "prompt": run["prompt"],
            "error": run["error"],
            "started_at": run["started_at"],
            "ended_at": run["ended_at"],
            "duration_ms": run["duration_ms"],
            "cost_usd": run["cost_usd"],
            "steps": run["steps"],
        }

    @staticmethod
    def _percentile(values: list[float], percentile: int) -> float | None:
        if not values:
            return None
        ordered = sorted(values)
        index = max(0, ceil((percentile / 100) * len(ordered)) - 1)
        return ordered[index]


store = RunStore()
