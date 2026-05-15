export type DataTableSpec = {
  table_id: string;
  label: string;
  schema: string;
  table: string;
  description: string;
};

export type DataTableColumn = {
  name: string;
  data_type: string;
};

export type DataTableRow = Record<string, unknown>;

export type DataTableQueryResult = {
  table: DataTableSpec;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  total: number;
  limit: number;
  offset: number;
  sort: string;
  direction: 'asc' | 'desc';
};

const API_BASE = '/api/data';

export async function fetchDataTableCatalog(signal?: AbortSignal): Promise<DataTableSpec[]> {
  const response = await fetch(`${API_BASE}/tables`, {
    headers: { accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => null) as { tables?: DataTableSpec[]; error?: string } | null;
  if (!response.ok || !payload?.tables) {
    throw new Error(payload?.error ?? 'Unable to load data table catalog.');
  }
  return payload.tables;
}

export async function fetchDataTableRows({
  table,
  search,
  filters,
  sort,
  direction,
  limit,
  offset,
  signal,
}: {
  table: string;
  search?: string;
  filters?: Record<string, string>;
  sort?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<DataTableQueryResult> {
  const params = new URLSearchParams({ table });
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);
  if (direction) params.set('direction', direction);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const activeFilters = Object.fromEntries(Object.entries(filters ?? {}).filter(([, value]) => value.trim() !== ''));
  if (Object.keys(activeFilters).length) params.set('filters', JSON.stringify(activeFilters));
  const response = await fetch(`${API_BASE}/query?${params.toString()}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => null) as (DataTableQueryResult & { error?: string }) | null;
  if (!response.ok || !payload || payload.error) {
    throw new Error(payload?.error ?? 'Unable to load data table rows.');
  }
  return payload;
}
