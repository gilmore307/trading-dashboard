import type { DashboardReadModel } from './types';

const API_BASE = '/api/read-models';

export async function fetchLatestReadModel(contractType: string, signal?: AbortSignal): Promise<DashboardReadModel> {
  const response = await fetch(`${API_BASE}/${contractType}/latest`, {
    headers: { accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'latest_path' in payload
      ? ` Missing file: ${String(payload.latest_path)}`
      : '';
    throw new Error(`Unable to load ${contractType}.${detail}`);
  }
  return payload as DashboardReadModel;
}
