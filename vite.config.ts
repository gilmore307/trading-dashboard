import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';

const DEFAULT_STORAGE_ROOT = '/root/projects/trading-storage/storage';
const SAFE_CONTRACT_RE = /^[a-z][a-z0-9_]*$/;

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

function dashboardReadModelApi(): Plugin {
  return {
    name: 'dashboard-read-model-api',
    configureServer(server) {
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
    },
  };
}

export default defineConfig({
  plugins: [react(), dashboardReadModelApi()],
});
