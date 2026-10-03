# Decisions

This project is a small app for looking through the example agent runs. It works
locally, but it is not ready for a large production dataset. This document explains
what it does and what I would improve.

## How the data is handled

- **Missing costs:** A missing cost is shown as `N/A`, not as `$0`. The dashboard
  adds up only the costs that are known. That means its total could be less than
  the real cost. The dashboard does not currently say how many costs are missing.
- **Success rate:** The app divides the number of successful runs by the number of
  all runs. This includes runs still in progress, so it is not the success rate of
  completed runs only. Duration summaries include only succeeded, failed, or
  cancelled runs with a recorded duration.
- **Messy records:** The data file has 201 lines, but one run ID appears twice, so
  the app loads 200 unique runs. It also has missing costs, runs in progress, a
  negative duration, and a run with no steps. The loader skips unreadable or
  unusable records, treats negative costs and durations as missing, and keeps the
  more complete version of a duplicate. It does not keep a report of skipped
  records.
- **Dashboard:** Dashboard statistics always cover all runs. They do not change
  when you filter the run list.

## What is not finished

- The runs page loads its data in the browser. The project brief asked for the list
  to be rendered by the server. Sorting is available in the API but not as a page
  control.
- Run explanations use `POST` and stream through a provider interface. The
  built-in mock provider is selected with `EXPLAIN_PROVIDER=mock` and works
  without an API key. It uses recorded run and error details; it is still a
  deterministic mock, not a language model.
- There are backend tests, including one that checks a success rate calculated by
  hand. There is no `frontend test` yet. A useful first one would check that typing
  part of an agent name into the search box shows matching runs. I skipped it
  because the project does not have frontend testing tools set up.

## What I would improve next

I would improve the success-rate calculation and its tests. I would also show how
many costs are missing and add a frontend test for agent search.

The app keeps all runs in memory, which is fine for this small example. For
20 million runs, I would use a database that can search and page through records
without loading everything into memory. Step details are already fetched only
when someone opens a run.

The biggest weakness right now is that the success-rate denominator includes
running runs. The explanation mock can report recorded failure details, but it
cannot infer a cause beyond the data.
