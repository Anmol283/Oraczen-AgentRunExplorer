import RunsClient from './RunsClient';

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

const PAGE_SIZE = 25;
const SORT_FIELDS = ['started_at', 'duration_ms', 'cost_usd'] as const;
type SortField = (typeof SORT_FIELDS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function validSortField(value: string): SortField {
  return SORT_FIELDS.includes(value as SortField) ? (value as SortField) : 'started_at';
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = firstParam(searchParams.status);
  const agent = firstParam(searchParams.agent);
  const query = firstParam(searchParams.q);
  const tool = firstParam(searchParams.tool);
  const startedAtFrom = firstParam(searchParams.started_at_from);
  const startedAtTo = firstParam(searchParams.started_at_to);
  const sort = validSortField(firstParam(searchParams.sort));
  const requestedOrder = firstParam(searchParams.order);
  const order = requestedOrder === 'asc' || requestedOrder === 'desc' ? requestedOrder : 'desc';
  const parsedPage = Number(firstParam(searchParams.page) || '1');
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const apiParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    sort,
    order,
  });
  if (status) apiParams.set('status', status);
  if (agent) apiParams.set('agent', agent);
  if (query) apiParams.set('q', query);
  if (tool) apiParams.set('tool', tool);
  if (startedAtFrom) apiParams.set('started_at_from', startedAtFrom);
  if (startedAtTo) apiParams.set('started_at_to', startedAtTo);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
  let initialRuns: Run[] = [];
  let initialTotal = 0;
  let initialError: string | null = null;

  try {
    const response = await fetch(`${apiBase}/api/runs?${apiParams}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      initialError = `Could not load runs from ${apiBase} (HTTP ${response.status}).`;
    } else {
      const payload: { items?: Run[]; total?: number } = await response.json();
      initialRuns = payload.items ?? [];
      initialTotal = payload.total ?? 0;
    }
  } catch (error) {
    console.error('Failed to load runs during server rendering:', error);
    initialError = `Could not load runs from ${apiBase}. Start the FastAPI backend first.`;
  }

  return (
    <RunsClient
      initialRuns={initialRuns}
      initialTotal={initialTotal}
      initialError={initialError}
      initialStatus={status}
      initialAgent={agent}
      initialQuery={query}
      initialTool={tool}
      initialStartedAtFrom={startedAtFrom}
      initialStartedAtTo={startedAtTo}
      initialPage={page}
      initialSort={sort}
      initialOrder={order}
    />
  );
}
