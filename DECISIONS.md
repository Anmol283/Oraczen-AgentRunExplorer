# Decisions

This is a small local explorer for the supplied dataset, not a production-scale
observability system. These notes describe what the code currently does and where
it falls short of the brief.

## Data and metric decisions

1. **Missing costs:** `cost_usd: null` means “not priced,” not zero. Per-agent
   totals sum only recorded costs, so they are known-cost subtotals rather than
   guaranteed full costs. The run list and detail page show missing cost as `N/A`.
   The dashboard does not show how many costs are missing, which makes its totals
   easier to misread.

2. **Running runs and success rate:** only `succeeded` runs contribute to the
   numerator, but the current denominator is all loaded runs, including `running`.
   The reported value is therefore the fraction of all runs that succeeded, not a
   success rate among completed runs. Duration statistics include records with a
   duration; they are not explicitly limited to completed runs. This is the
   implementation today, not an ideal metric definition.

3. **Messy data:** the supplied file has 201 lines and 200 unique IDs because
   `run_0031` is duplicated. It also includes null costs, running runs, a negative
   duration, and an empty steps array. The loader normalizes fields, treats
   negative durations and costs as missing, skips malformed JSON and unusable
   records, and chooses between duplicate IDs using a basic completeness score.
   That duplicate rule is pragmatic for this fixture; it is not a robust way to
   reconcile conflicting production records. Rejected-row diagnostics are not
   retained or exposed through the API.

4. **Dashboard scope:** `/api/stats` is global to the loaded dataset and does not
   change when the runs list is filtered.

## Current gaps and next steps

- The list API returns full `steps` arrays, despite the brief asking that list
  responses omit them. I would fix this first to reduce response size.
- Date-range filtering is not implemented. I would add it to the API and test
  combinations with the existing filters.
- The runs page fetches data in the browser; it is not the server-rendered page
  requested in the brief. Its sort order is fixed, although the API supports
  sorting.
- Explanations stream over `GET`, not the requested `POST`, and currently summarize
  run fields and steps rather than explaining failure causes. There is no
  provider interface or environment-selected mock; the stream is generated
  directly by the backend.
- Tests cover basic filters, tool filtering, a fixed total count, missing-run 404s,
  and the explain stream. There is no hand-calculated stats assertion or frontend
  test. I would add those before relying on the dashboard metrics or keyboard and
  URL behavior.

With another day, I would address the API contract and metric-definition gaps,
add focused backend and frontend tests, and show missing-cost counts alongside
known-cost subtotals. For 20 million runs, I would replace in-memory JSONL loading
with durable indexed storage, query-level filtering and pagination, keep step
payloads out of list queries, and use cached or background-computed aggregates.
The exact storage choice should follow the expected write rate and query patterns.

The parts I am least happy with are the steps included in list responses and the
gap between the dashboard’s simple statistics and the brief’s completed-run
metrics. The current explanation stream is useful to demonstrate streaming, but
it should not be mistaken for a real diagnosis of a failed run.
