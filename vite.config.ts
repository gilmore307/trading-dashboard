import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';

const DEFAULT_STORAGE_ROOT = '/root/projects/trading-storage/storage';
const SAFE_CONTRACT_RE = /^[a-z][a-z0-9_]*$/;
const SAFE_TABLE_ID_RE = /^[a-z][a-z0-9_]*$/;
const DASHBOARD_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REGISTERED_READ_MODELS = new Set([
  'current_system_status_summary',
  'alert_exception_summary',
  'historical_task_progress_summary',
  'realtime_task_progress_summary',
  'model_layer_readiness_summary',
  'model_promotion_posture_summary',
  'registry_dictionary_profile',
  'realtime_signal_summary',
  'execution_realtime_trading_runtime_status',
  'runtime_decision_quality_summary',
  'trading_performance_summary',
  'storage_lifecycle_status_summary',
]);
const REQUIRED_READ_MODEL_FIELDS = [
  'contract_type',
  'schema_version',
  'generated_at_utc',
  'source_system',
  'status',
  'summary',
  'chart_payload',
  'profile_refs',
  'issue_refs',
  'diagnostic_refs',
  'lineage_refs',
  'freshness',
  'schema_ref',
];

function storageRoot(): string {
  return process.env.TRADING_DASHBOARD_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT;
}

function canonicalContractType(contractType: string): string {
  if (!SAFE_CONTRACT_RE.test(contractType)) {
    throw new Error(`unsafe dashboard read-model contract_type: ${contractType}`);
  }
  if (!REGISTERED_READ_MODELS.has(contractType)) {
    throw new Error(`unregistered dashboard read-model contract_type: ${contractType}`);
  }
  return contractType;
}

function latestReadModelPath(contractType: string): string {
  return path.join(storageRoot(), '06_dashboard_cache', 'read_models', canonicalContractType(contractType), 'latest.json');
}

function validateReadModelPayload(payload: unknown, expectedContractType: string): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('dashboard read-model latest payload must be a JSON object');
  }
  const record = payload as Record<string, unknown>;
  const missing = REQUIRED_READ_MODEL_FIELDS.filter((field) => !(field in record));
  if (missing.length) {
    throw new Error(`missing required dashboard read-model fields: ${missing.join(', ')}`);
  }
  if (canonicalContractType(String(record.contract_type)) !== expectedContractType) {
    throw new Error(`latest payload contract_type does not match expected ${expectedContractType}`);
  }
  if (!Number.isInteger(record.schema_version) || Number(record.schema_version) < 1) {
    throw new Error('schema_version must be a positive integer');
  }
  for (const field of ['generated_at_utc', 'source_system', 'status', 'summary', 'schema_ref']) {
    if (typeof record[field] !== 'string' || !String(record[field]).trim()) {
      throw new Error(`${field} must be a non-empty string`);
    }
  }
  if (typeof record.chart_payload !== 'object' || record.chart_payload === null) {
    throw new Error('chart_payload must be a JSON object or array');
  }
  if (typeof record.freshness !== 'object' || record.freshness === null || Array.isArray(record.freshness)) {
    throw new Error('freshness must be a JSON object');
  }
  for (const field of ['profile_refs', 'issue_refs', 'diagnostic_refs', 'lineage_refs']) {
    if (!Array.isArray(record[field])) {
      throw new Error(`${field} must be a JSON array`);
    }
  }
  return record;
}

function readLatestPayload(contractType: string): { payload: Record<string, unknown>; contractType: string; latestPath: string } {
  const canonicalType = canonicalContractType(contractType);
  const latestPath = latestReadModelPath(contractType);
  const payload = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  return { payload: validateReadModelPayload(payload, canonicalType), contractType: canonicalType, latestPath };
}

function sendReadModelSnapshot(socket: WebSocket, contractType: string): void {
  try {
    const snapshot = readLatestPayload(contractType);
    socket.send(JSON.stringify({
      type: 'read_model_snapshot',
      contract_type: snapshot.contractType,
      payload: snapshot.payload,
      sent_at_utc: new Date().toISOString(),
    }));
  } catch (error) {
    socket.send(JSON.stringify({
      type: 'read_model_error',
      contract_type: contractType,
      error: error instanceof Error ? error.message : 'unknown read-model websocket error',
      sent_at_utc: new Date().toISOString(),
    }));
  }
}

function attachReadModelSocket(socket: WebSocket, contractType: string): void {
  const canonicalType = canonicalContractType(contractType);
  let lastMtimeMs = -1;
  let watcher: fs.FSWatcher | undefined;
  let fallbackInterval: ReturnType<typeof setInterval> | undefined;
  const pushIfChanged = () => {
    try {
      const mtimeMs = fs.statSync(latestReadModelPath(contractType)).mtimeMs;
      if (mtimeMs === lastMtimeMs) return;
      lastMtimeMs = mtimeMs;
      sendReadModelSnapshot(socket, contractType);
    } catch {
      sendReadModelSnapshot(socket, contractType);
    }
  };

  const attachWatcher = () => {
    const latestPath = latestReadModelPath(contractType);
    const latestDir = path.dirname(latestPath);
    const latestFile = path.basename(latestPath);
    watcher = fs.watch(latestDir, (_eventType, filename) => {
      if (!filename || filename.toString() === latestFile) pushIfChanged();
    });
  };

  pushIfChanged();
  try {
    attachWatcher();
  } catch {
    fallbackInterval = setInterval(pushIfChanged, 1_000);
  }
  const mtimePollInterval = setInterval(pushIfChanged, 2_000);
  const heartbeatInterval = setInterval(() => {
    socket.send(JSON.stringify({
      type: 'read_model_heartbeat',
      contract_type: canonicalType,
      sent_at_utc: new Date().toISOString(),
    }));
  }, 30_000);
  socket.on('close', () => {
    watcher?.close();
    if (fallbackInterval) clearInterval(fallbackInterval);
    clearInterval(mtimePollInterval);
    clearInterval(heartbeatInterval);
  });
}

function runDataTableHelper(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python3', ['-m', 'trading_dashboard.data_tables', ...args], {
      cwd: DASHBOARD_ROOT,
      env: {
        ...process.env,
        PYTHONPATH: path.join(DASHBOARD_ROOT, 'src'),
      },
      timeout: 15_000,
      maxBuffer: 1024 * 1024 * 4,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function sendJson(res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function attachDashboardDataTableApi(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use('/api/data', (req, res) => {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    void (async () => {
      try {
        if (parsedUrl.pathname === '/tables') {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(await runDataTableHelper(['list']));
          return;
        }
        if (parsedUrl.pathname === '/query') {
          const table = parsedUrl.searchParams.get('table') ?? '';
          if (!SAFE_TABLE_ID_RE.test(table)) {
            sendJson(res, 400, { error: 'unknown or unsafe data table id' });
            return;
          }
          const args = ['query', '--table', table];
          const search = parsedUrl.searchParams.get('search');
          const sort = parsedUrl.searchParams.get('sort');
          const direction = parsedUrl.searchParams.get('direction');
          const limit = parsedUrl.searchParams.get('limit');
          const offset = parsedUrl.searchParams.get('offset');
          const filters = parsedUrl.searchParams.get('filters');
          if (search) args.push('--search', search.slice(0, 200));
          if (sort) args.push('--sort', sort);
          if (direction) args.push('--direction', direction === 'desc' ? 'desc' : 'asc');
          if (limit) args.push('--limit', limit);
          if (offset) args.push('--offset', offset);
          if (filters) args.push('--filters-json', filters);
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(await runDataTableHelper(args));
          return;
        }
        sendJson(res, 404, { error: 'unknown data route' });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'dashboard data table error' });
      }
    })();
  });
}

function attachDashboardReadModelApi(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use('/api/read-models', (req, res) => {
    const url = req.url ?? '';
    const match = url.match(/^\/([a-z][a-z0-9_]*)\/latest(?:\?.*)?$/);
    if (!match || !SAFE_CONTRACT_RE.test(match[1])) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'unknown read-model route' }));
      return;
    }
    try {
      const snapshot = readLatestPayload(match[1]);
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(snapshot.payload));
    } catch (error) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'dashboard read-model latest.json not found',
        contract_type: match[1],
      }));
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.httpServer?.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const match = pathname.match(/^\/ws\/read-models\/([a-z][a-z0-9_]*)\/latest$/);
    if (!match || !SAFE_CONTRACT_RE.test(match[1])) return;
    let contractType: string;
    try {
      contractType = canonicalContractType(match[1]);
    } catch {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (webSocket) => {
      attachReadModelSocket(webSocket, contractType);
    });
  });
}

function dashboardReadModelApi(): Plugin {
  return {
    name: 'dashboard-read-model-api',
    configureServer(server) {
      attachDashboardReadModelApi(server);
      attachDashboardDataTableApi(server);
    },
    configurePreviewServer(server) {
      attachDashboardReadModelApi(server);
      attachDashboardDataTableApi(server);
    },
  };
}

export default defineConfig({
  plugins: [react(), dashboardReadModelApi()],
});
