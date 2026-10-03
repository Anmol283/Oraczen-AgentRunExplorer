# Decisions

1. Cost handling for null rows: I treat `cost_usd: null` as "not priced" rather than zero. The dashboard totals per agent use only rows with a real price, and the UI labels any unpriced run as `N/A` so we stay honest about missing data instead of silently inventing a cost.
2. Running jobs: runs with status `running` are not counted as successful in the success-rate calculation, because they have no completed end state yet. They still appear in the data set and sort by `started_at`, but they do not inflate the completion rate.
3. Messy-data handling: the dataset has one duplicate run ID (`run_0031`), three null-cost entries, nine `running` records, one negative duration, and one empty steps array. The backend loader cleans and normalizes the rows, skips malformed JSON, and keeps the best version of a duplicate record instead of silently returning wrong data.
4. Dashboard stats scope: I kept `/api/stats` global to the dataset rather than filtering it by the page’s current `status`/`agent` URL params. That keeps the dashboard stable and easy to reason about, while the list page still applies filters at the `/api/runs` endpoint.

I also observed that the dataset is intentionally production-like and not perfectly clean, which is exactly why the loader handles missing or malformed values explicitly instead of assuming every line is valid.
