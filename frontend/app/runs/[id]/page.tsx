'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Run = {
  id: string;
  agent: string;
  status: string;
  prompt: string;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  steps: Array<{ name?: string; status?: string; summary?: string } | string>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`${API_BASE}/api/runs/${params.id}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setRun(payload);
        setError(null);
      })
      .catch((error) => {
        console.error(error);
        setError(`Could not load run ${params.id} from ${API_BASE}. The backend must be running.`);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleExplain = async () => {
    if (!params?.id) return;
    setMessages([]);
    const response = await fetch(`${API_BASE}/api/explain?run_id=${params.id}`);
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.replace('data: ', '');
        try {
          const item = JSON.parse(payload);
          if (item.message) setMessages((current) => [...current, item.message]);
          if (item.done) setMessages((current) => [...current, 'Finished explain stream']);
        } catch {
          // ignore invalid partial writes
        }
      }
    }
  };

  if (error) {
    return (
      <main>
        <div className="card">
          <h2>Run unavailable</h2>
          <p>{error}</p>
          <p className="small-muted">The backend loads the data from <strong>data/runs.jsonl</strong> when it starts.</p>
        </div>
      </main>
    );
  }

  if (loading) return <main><div className="card">Loading run...</div></main>;
  if (!run) return <main><div className="card">Run not found.</div></main>;

  return (
    <main>
      <div className="topbar">
        <div>
          <h1>{run.id}</h1>
          <div className="small-muted">Run detail</div>
        </div>
        <nav className="nav">
          <Link href="/runs">Back to runs</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </div>

      <div className="detail-layout">
        <section className="card">
          <span className={`status-badge status-${run.status}`}>{run.status}</span>
          <div className="pill-list">
            <span className="pill">Agent: {run.agent}</span>
            <span className="pill">Started: {run.started_at ? new Date(run.started_at).toLocaleString() : 'Unknown'}</span>
            <span className="pill">Ended: {run.ended_at ? new Date(run.ended_at).toLocaleString() : 'Unknown'}</span>
            <span className="pill">Duration: {run.duration_ms === null ? 'N/A' : `${run.duration_ms} ms`}</span>
            <span className="pill">Cost: {run.cost_usd === null ? 'N/A' : `$${run.cost_usd.toFixed(2)}`}</span>
          </div>

          <h3>Prompt</h3>
          <pre>{run.prompt || 'No prompt provided.'}</pre>

          {run.error ? (
            <>
              <h3>Error</h3>
              <pre>{run.error}</pre>
            </>
          ) : null}

          <h3>Execution steps</h3>
          {run.steps && run.steps.length > 0 ? (
            <ul>
              {run.steps.map((step, index) => {
                const name = typeof step === 'string' ? step : step.name || 'Step';
                const status = typeof step === 'string' ? 'step' : step.status || 'step';
                return (
                  <li key={`${name}-${index}`}>
                    <strong>{index + 1}.</strong> {name} <em>({status})</em>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No steps recorded for this run.</p>
          )}
        </section>

        <aside className="card">
          <h3>Explain</h3>
          <button onClick={handleExplain}>Run explanation</button>
          <div style={{ marginTop: 12 }}>
            {messages.length === 0 ? <p className="small-muted">No explanation yet.</p> : (
              <ul>
                {messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
