'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [agent, setAgent] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (agent) params.set('agent', agent);
    if (query) params.set('q', query);
    return params.toString() ? `?${params.toString()}` : '';
  }, [status, agent, query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.get('status') ?? '');
    setAgent(params.get('agent') ?? '');
    setQuery(params.get('q') ?? '');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (agent) params.set('agent', agent);
    if (query) params.set('q', query);
    params.set('limit', '25');
    params.set('sort', 'started_at');
    params.set('order', 'desc');

    const url = `${API_BASE}/api/runs?${params.toString()}`;
    setLoading(true);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setRuns(payload.items ?? []);
        setTotal(payload.total ?? 0);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error(error);
          setError(`Could not load runs from ${API_BASE}. Start the FastAPI backend first.`);
        }
      })
      .finally(() => setLoading(false));

    window.history.replaceState({}, '', currentUrl || window.location.pathname);
    return () => controller.abort();
  }, [status, agent, query, currentUrl]);

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
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            value={agent}
            onChange={(event) => setAgent(event.target.value)}
            placeholder="Agent name"
          />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompt or ID"
          />
        </div>

        <p className="small-muted">Showing {runs.length} of {total} runs</p>

        {error ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p>{error}</p>
            <p className="small-muted">The backend reads the data from <strong>data/runs.jsonl</strong>, so no manual data import is required.</p>
          </div>
        ) : loading ? (
          <p>Loading runs...</p>
        ) : (
          <table className="table">
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
              {runs.map((run) => (
                <tr key={run.id}>
                  <td><Link href={`/runs/${run.id}`}>{run.id}</Link></td>
                  <td>{run.agent}</td>
                  <td>
                    <span className={`status-badge status-${run.status}`}>{run.status}</span>
                  </td>
                  <td>{run.started_at ? new Date(run.started_at).toLocaleString() : 'Unknown'}</td>
                  <td>{run.duration_ms === null ? 'N/A' : `${run.duration_ms} ms`}</td>
                  <td>{run.cost_usd === null ? 'N/A' : `$${run.cost_usd.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
