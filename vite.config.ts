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

function storageRoot(): string {
  return process.env.TRADING_DASHBOARD_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT;
}

function canonicalContractType(contractType: string): string {
  return contractType.replace(/_v[0-9]+$/, '');
}

function latestReadModelPath(contractType: string): string {
  const canonicalType = canonicalContractType(contractType);
  const canonicalPath = path.join(storageRoot(), 'dashboard', 'read_models', canonicalType, 'latest.json');
  if (canonicalType !== contractType) {
    const legacyPath = path.join(storageRoot(), 'dashboard', 'read_models', contractType, 'latest.json');
    return fs.existsSync(canonicalPath) ? canonicalPath : legacyPath;
  }
  return canonicalPath;
}

function readLatestPayload(contractType: string): string {
  return fs.readFileSync(latestReadModelPath(contractType), 'utf8');
}

function sendReadModelSnapshot(socket: WebSocket, contractType: string): void {
  const latestPath = latestReadModelPath(contractType);
  try {
    const payload = JSON.parse(readLatestPayload(contractType));
    socket.send(JSON.stringify({
      type: 'read_model_snapshot',
      contract_type: canonicalContractType(contractType),
      payload,
      sent_at_utc: new Date().toISOString(),
    }));
  } catch (error) {
    socket.send(JSON.stringify({
      type: 'read_model_error',
      contract_type: canonicalContractType(contractType),
      latest_path: latestPath,
      error: error instanceof Error ? error.message : 'unknown read-model websocket error',
      sent_at_utc: new Date().toISOString(),
    }));
  }
}

function attachReadModelSocket(socket: WebSocket, contractType: string): void {
  let lastMtimeMs = -1;
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
  pushIfChanged();
  const watchInterval = setInterval(pushIfChanged, 1_000);
  const heartbeatInterval = setInterval(() => {
    socket.send(JSON.stringify({
      type: 'read_model_heartbeat',
      contract_type: canonicalContractType(contractType),
      sent_at_utc: new Date().toISOString(),
    }));
  }, 30_000);
  socket.on('close', () => {
    clearInterval(watchInterval);
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
    const latestPath = latestReadModelPath(match[1]);
    try {
      const payload = readLatestPayload(match[1]);
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(payload);
    } catch {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: 'dashboard read-model latest.json not found',
        contract_type: match[1],
        latest_path: latestPath,
      }));
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.httpServer?.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const match = pathname.match(/^\/ws\/read-models\/([a-z][a-z0-9_]*)\/latest$/);
    if (!match || !SAFE_CONTRACT_RE.test(match[1])) return;
    wss.handleUpgrade(request, socket, head, (webSocket) => {
      attachReadModelSocket(webSocket, match[1]);
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
