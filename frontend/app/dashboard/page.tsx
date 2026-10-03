'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Stats = {
  total_runs: number;
  success_rate: number;
  status_counts: Record<string, number>;
  by_agent: Record<string, { runs: number; success_rate: number }>;
  cost_by_agent: Record<string, number>;
  daily_counts: Record<string, number>;
  duration_summary: { median_ms: number | null; p95_ms: number | null; average_ms: number | null };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setStats(payload);
        setError(null);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError(`Could not load dashboard data from ${API_BASE}. Start the FastAPI backend first.`);
      });
  }, []);

  if (error) {
    return (
      <main>
        <div className="card">
          <h2>Dashboard unavailable</h2>
          <p>{error}</p>
          <p className="small-muted">The backend reads the data from <strong>data/runs.jsonl</strong> at startup.</p>
        </div>
      </main>
    );
  }

  if (!stats) {
    return <main><div className="card">Loading dashboard...</div></main>;
  }

  const statusEntries = Object.entries(stats.status_counts);
  const agentEntries = Object.entries(stats.by_agent).slice(0, 6);
  const dailyEntries = Object.entries(stats.daily_counts).slice(-7);
  const maxDaily = Math.max(...dailyEntries.map(([, value]) => value), 1);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="small-muted">Operational overview</div>
        </div>
        <nav className="nav">
          <Link href="/runs">Runs</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </div>

      <section className="grid summary-grid">
        <div className="metric">
          <div className="metric-label">Total runs</div>
          <div className="metric-value">{stats.total_runs}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Success rate</div>
          <div className="metric-value">{(stats.success_rate * 100).toFixed(1)}%</div>
        </div>
        <div className="metric">
          <div className="metric-label">Median duration</div>
          <div className="metric-value">{stats.duration_summary.median_ms ?? 'N/A'} ms</div>
        </div>
        <div className="metric">
          <div className="metric-label">P95 duration</div>
          <div className="metric-value">{stats.duration_summary.p95_ms ?? 'N/A'} ms</div>
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        <div className="card">
          <h3>Status counts</h3>
          <ul>
            {statusEntries.map(([status, count]) => (
              <li key={status}>{status}: {count}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Agent success</h3>
          <ul>
            {agentEntries.map(([agent, data]) => (
              <li key={agent}>{agent}: {(data.success_rate * 100).toFixed(1)}% success over {data.runs} runs</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Daily run volume</h3>
        <div className="chart">
          {dailyEntries.map(([day, count]) => (
            <div key={day} className="bar" style={{ height: `${(count / maxDaily) * 100}%` }}>
              <span>{day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Cost by agent</h3>
        <ul>
          {Object.entries(stats.cost_by_agent).map(([agent, cost]) => (
            <li key={agent}>{agent}: ${cost.toFixed(2)}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
