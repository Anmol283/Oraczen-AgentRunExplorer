from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any, Protocol


class ExplainProvider(Protocol):
    async def stream(self, run: dict[str, Any]) -> AsyncIterator[str]: ...


class MockExplainProvider:
    async def stream(self, run: dict[str, Any]) -> AsyncIterator[str]:
        steps = run.get("steps") or []
        step_names = [
            str(step.get("name") or f"step {step.get('index', '?')}")
            if isinstance(step, dict)
            else str(step)
            for step in steps
        ]
        messages = [
            f"Run {run['id']} was handled by {run['agent']} and has status {run['status']}."
        ]
        if step_names:
            messages.append(f"It executed these steps: {', '.join(step_names)}.")
        else:
            messages.append("No execution steps were recorded.")

        if run["status"] == "failed":
            failed_step = next(
                (
                    step
                    for step in steps
                    if isinstance(step, dict) and step.get("status") == "failed"
                ),
                None,
            )
            if failed_step:
                location = failed_step.get("name") or f"step {failed_step.get('index', '?')}"
                messages.append(f"It failed at {location}.")
            if run.get("error"):
                messages.append(f"Error: {run['error']}")
            elif not failed_step:
                messages.append("The run failed, but no failure details were recorded.")

        for message in messages:
            await asyncio.sleep(0.05)
            yield message
