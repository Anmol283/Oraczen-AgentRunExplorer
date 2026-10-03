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
  steps: Array<{
    name?: string;
    tool?: string;
    status?: string;
    summary?: string;
    duration_ms?: number | null;
    input?: unknown;
    output?: unknown;
    tokens?: { input?: number; output?: number };
  } | string>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

function formatStepValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [deepLinkedStep, setDeepLinkedStep] = useState<number | null>(null);

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
        const match = window.location.hash.match(/^#step-(\d+)$/);
        const stepNumber = match ? Number(match[1]) : null;
        const validStep = stepNumber && stepNumber <= payload.steps.length ? stepNumber : null;
        setExpandedSteps(validStep ? [validStep] : []);
        setDeepLinkedStep(validStep);
        setError(null);
      })
      .catch((error) => {
        console.error(error);
        setError(`Could not load run ${params.id} from ${API_BASE}. The backend must be running.`);
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    if (!run || !deepLinkedStep) return;
    requestAnimationFrame(() => {
      document.getElementById(`step-${deepLinkedStep}`)?.scrollIntoView({ block: 'center' });
    });
  }, [run, deepLinkedStep]);

  const handleExplain = async () => {
    if (!params?.id) return;
    setMessages([]);
    const response = await fetch(`${API_BASE}/api/runs/${encodeURIComponent(params.id)}/explain`, {
      method: 'POST',
    });
    if (!response.ok) {
      setMessages([`Explanation request failed (HTTP ${response.status}).`]);
      return;
    }
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
            <div className="step-list">
              {run.steps.map((step, index) => {
                const stepNumber = index + 1;
                const details = typeof step === 'string' ? null : step;
                const name = details?.name || (typeof step === 'string' ? step : 'Step');
                const status = details?.status || 'step';
                const tokens = details?.tokens;
                return (
                  <details
                    className="step-detail"
                    id={`step-${stepNumber}`}
                    key={`${name}-${index}`}
                    open={expandedSteps.includes(stepNumber)}
                    onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setExpandedSteps((current) => isOpen
                        ? current.includes(stepNumber) ? current : [...current, stepNumber]
                        : current.filter((value) => value !== stepNumber));
                    }}
                  >
                    <summary>
                      <span><strong>Step {stepNumber}:</strong> {name}</span>
                      <span className="small-muted">
                        {details?.tool ? `${details.tool} · ` : ''}{status}
                        {details?.duration_ms != null ? ` · ${details.duration_ms} ms` : ''}
                        {tokens ? ` · ${tokens.input ?? 0}/${tokens.output ?? 0} tokens` : ''}
                      </span>
                    </summary>
                    <div className="step-content">
                      {details?.summary ? <p>{details.summary}</p> : null}
                      <h4>Input</h4>
                      <pre>{formatStepValue(details?.input)}</pre>
                      <h4>Output</h4>
                      <pre>{formatStepValue(details?.output)}</pre>
                    </div>
                  </details>
                );
              })}
            </div>
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
