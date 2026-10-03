'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type Run = {
  id: string;
  agent: string;
  status: string;
  prompt: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
};

type SortField = 'started_at' | 'duration_ms' | 'cost_usd';
type SortOrder = 'asc' | 'desc';

type RunsClientProps = {
  initialRuns: Run[];
  initialTotal: number;
  initialError: string | null;
  initialStatus: string;
  initialAgent: string;
  initialQuery: string;
  initialTool: string;
  initialStartedAtFrom: string;
  initialStartedAtTo: string;
  initialPage: number;
  initialSort: SortField;
  initialOrder: SortOrder;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const PAGE_SIZE = 25;

export default function RunsClient({
  initialRuns,
  initialTotal,
  initialError,
  initialStatus,
  initialAgent,
  initialQuery,
  initialTool,
  initialStartedAtFrom,
  initialStartedAtTo,
  initialPage,
  initialSort,
  initialOrder,
}: RunsClientProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState(initialStatus);
  const [agent, setAgent] = useState(initialAgent);
  const [query, setQuery] = useState(initialQuery);
  const [tool, setTool] = useState(initialTool);
  const [startedAtFrom, setStartedAtFrom] = useState(initialStartedAtFrom);
  const [startedAtTo, setStartedAtTo] = useState(initialStartedAtTo);
  const [sort, setSort] = useState<SortField>(initialSort);
  const [order, setOrder] = useState<SortOrder>(initialOrder);
  const [appliedStatus, setAppliedStatus] = useState(initialStatus);
  const [appliedAgent, setAppliedAgent] = useState(initialAgent);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [appliedTool, setAppliedTool] = useState(initialTool);
  const [appliedStartedAtFrom, setAppliedStartedAtFrom] = useState(initialStartedAtFrom);
  const [appliedStartedAtTo, setAppliedStartedAtTo] = useState(initialStartedAtTo);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [lastRequestDuration, setLastRequestDuration] = useState<number | null>(null);
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRun = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRun = Math.min(page * PAGE_SIZE, total);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedStatus) params.set('status', appliedStatus);
    if (appliedAgent) params.set('agent', appliedAgent);
    if (appliedQuery) params.set('q', appliedQuery);
    if (appliedTool) params.set('tool', appliedTool);
    if (appliedStartedAtFrom) params.set('started_at_from', appliedStartedAtFrom);
    if (appliedStartedAtTo) params.set('started_at_to', appliedStartedAtTo);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    params.set('sort', sort);
    params.set('order', order);
    return params;
  }, [
    appliedStatus,
    appliedAgent,
    appliedQuery,
    appliedTool,
    appliedStartedAtFrom,
    appliedStartedAtTo,
    page,
    sort,
    order,
  ]);
  const requestKey = requestParams.toString();
  const initialRequestKey = useRef(requestKey);

  const currentUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedStatus) params.set('status', appliedStatus);
    if (appliedAgent) params.set('agent', appliedAgent);
    if (appliedQuery) params.set('q', appliedQuery);
    if (appliedTool) params.set('tool', appliedTool);
    if (appliedStartedAtFrom) params.set('started_at_from', appliedStartedAtFrom);
    if (appliedStartedAtTo) params.set('started_at_to', appliedStartedAtTo);
    params.set('sort', sort);
    params.set('order', order);
    if (page > 1) params.set('page', String(page));
    return params.toString() ? `?${params.toString()}` : '';
  }, [
    appliedStatus,
    appliedAgent,
    appliedQuery,
    appliedTool,
    appliedStartedAtFrom,
    appliedStartedAtTo,
    page,
    sort,
    order,
  ]);

  useEffect(() => {
    const nextAgent = agent.trim();
    const nextQuery = query.trim();
    const nextTool = tool.trim();
    const nextStartedAtFrom = startedAtFrom;
    const nextStartedAtTo = startedAtTo;
    const filtersChanged =
      nextAgent !== appliedAgent ||
      nextQuery !== appliedQuery ||
      nextTool !== appliedTool ||
      nextStartedAtFrom !== appliedStartedAtFrom ||
      nextStartedAtTo !== appliedStartedAtTo;
    const timeout = window.setTimeout(() => {
      if (filtersChanged) setPage(1);
      setAppliedAgent(nextAgent);
      setAppliedQuery(nextQuery);
      setAppliedTool(nextTool);
      setAppliedStartedAtFrom(nextStartedAtFrom);
      setAppliedStartedAtTo(nextStartedAtTo);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [
    agent,
    query,
    tool,
    startedAtFrom,
    startedAtTo,
    appliedAgent,
    appliedQuery,
    appliedTool,
    appliedStartedAtFrom,
    appliedStartedAtTo,
  ]);

  useEffect(() => {
    if (requestKey === initialRequestKey.current) {
      initialRequestKey.current = '';
      return;
    }

    const controller = new AbortController();
    const startedAt = performance.now();
    setRequestCount((count) => count + 1);
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/runs?${requestKey}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        const nextTotal = payload.total ?? 0;
        const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        setTotal(nextTotal);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRuns(payload.items ?? []);
        setSelectedIndex(0);
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          console.error(fetchError);
          setError(`Could not load runs from ${API_BASE}. Start the FastAPI backend first.`);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLastRequestDuration(Math.round(performance.now() - startedAt));
          setLoading(false);
        }
      });

    window.history.replaceState({}, '', currentUrl || window.location.pathname);
    return () => controller.abort();
  }, [requestKey, currentUrl, page]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, select, textarea, button, a'))
      ) {
        return;
      }
      if (loading || error || runs.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, runs.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter' && runs[selectedIndex]) {
        event.preventDefault();
        router.push(`/runs/${encodeURIComponent(runs[selectedIndex].id)}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [error, loading, router, runs, selectedIndex]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Run Explorer</h1>
          <div className="small-muted">Working with a messy production dataset</div>
        </div>
        <nav className="nav">
          <Link href="/runs">Runs</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </div>

      <section className="card">
        <h2>Filters</h2>
        <div className="toolbar">
          <select value={status} onChange={(event) => {
            setStatus(event.target.value);
            setAppliedStatus(event.target.value);
            setPage(1);
          }}>
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            value={agent}
            onChange={(event) => setAgent(event.target.value)}
            placeholder="Search agent name"
            aria-label="Search agent name"
          />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompt or ID"
          />

          <input
            value={tool}
            onChange={(event) => setTool(event.target.value)}
            placeholder="Tool name(s)"
            aria-label="Filter by step tool"
          />

          <label>
            Started from
            <input
              type="date"
              value={startedAtFrom}
              onChange={(event) => setStartedAtFrom(event.target.value)}
              aria-label="Started at or after"
            />
          </label>

          <label>
            Started to
            <input
              type="date"
              value={startedAtTo}
              onChange={(event) => setStartedAtTo(event.target.value)}
              aria-label="Started at or before"
            />
          </label>

          <label>
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortField);
                setPage(1);
              }}
              aria-label="Sort runs by"
            >
              <option value="started_at">Started</option>
              <option value="duration_ms">Duration</option>
              <option value="cost_usd">Cost</option>
            </select>
          </label>

          <label>
            Order
            <select
              value={order}
              onChange={(event) => {
                setOrder(event.target.value as SortOrder);
                setPage(1);
              }}
              aria-label="Sort order"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>

        <p className="small-muted">
          Showing {firstRun}–{lastRun} of {total} runs · Page {page} of {pageCount}
        </p>
        <p className="small-muted request-metrics" aria-live="polite">
          API requests: {requestCount} · Latest: {lastRequestDuration === null ? '—' : `${lastRequestDuration} ms`}
          {loading ? ' · Loading' : ''}
        </p>

        {error ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p>{error}</p>
            <p className="small-muted">The backend reads the data from <strong>data/runs.jsonl</strong>, so no manual data import is required.</p>
          </div>
        ) : loading ? (
          <p>Loading runs...</p>
        ) : runs.length === 0 ? (
          <p>No runs match these filters.</p>
        ) : (
          <table className="table" aria-label="Agent runs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, index) => (
                <tr
                  key={run.id}
                  className={selectedIndex === index ? 'keyboard-selected' : undefined}
                  aria-selected={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                >
                  <td><Link href={`/runs/${run.id}`}>{run.id}</Link></td>
                  <td>{run.agent}</td>
                  <td>
                    <span className={`status-badge status-${run.status}`}>{run.status}</span>
                  </td>
                  <td>{run.started_at ?? 'Unknown'}</td>
                  <td>{run.duration_ms === null ? 'N/A' : `${run.duration_ms} ms`}</td>
                  <td>{run.cost_usd === null ? 'N/A' : `$${run.cost_usd.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!error && total > 0 ? (
          <nav className="pagination" aria-label="Run pages">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
            >
              Previous
            </button>
            <span className="small-muted">Page {page} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={loading || page >= pageCount}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
