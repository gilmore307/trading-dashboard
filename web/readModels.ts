import type { DashboardReadModel } from './types';

const API_BASE = '/api/read-models';
const WS_BASE = '/ws/read-models';

export type ReadModelStreamStatus = 'connecting' | 'live' | 'fallback';

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

function websocketUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

export function openLatestReadModelSocket(
  contractType: string,
  handlers: {
    onSnapshot: (payload: DashboardReadModel) => void;
    onStatus?: (status: ReadModelStreamStatus) => void;
    onError?: (message: string) => void;
  },
): WebSocket {
  handlers.onStatus?.('connecting');
  const socket = new WebSocket(websocketUrl(`${WS_BASE}/${contractType}/latest`));
  socket.addEventListener('open', () => handlers.onStatus?.('live'));
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { type?: string; payload?: DashboardReadModel; error?: string };
    if (message.type === 'read_model_snapshot' && message.payload) {
      handlers.onSnapshot(message.payload);
      handlers.onStatus?.('live');
      return;
    }
    if (message.type === 'read_model_error') {
      handlers.onError?.(message.error ?? `Unable to stream ${contractType}`);
    }
  });
  socket.addEventListener('error', () => {
    handlers.onStatus?.('fallback');
    handlers.onError?.(`WebSocket unavailable for ${contractType}; using HTTP fallback.`);
  });
  socket.addEventListener('close', () => handlers.onStatus?.('fallback'));
  return socket;
}
