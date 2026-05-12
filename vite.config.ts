import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const DEFAULT_STORAGE_ROOT = '/root/projects/trading-storage/storage';
const SAFE_CONTRACT_RE = /^[a-z][a-z0-9_]*_v[0-9]+$/;

function dashboardReadModelApi(): Plugin {
  return {
    name: 'dashboard-read-model-api',
    configureServer(server) {
      server.middlewares.use('/api/read-models', (req, res) => {
        const url = req.url ?? '';
        const match = url.match(/^\/([a-z][a-z0-9_]*_v[0-9]+)\/latest(?:\?.*)?$/);
        if (!match || !SAFE_CONTRACT_RE.test(match[1])) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'unknown read-model route' }));
          return;
        }
        const storageRoot = process.env.TRADING_DASHBOARD_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT;
        const latestPath = path.join(storageRoot, 'dashboard', 'read_models', match[1], 'latest.json');
        try {
          const payload = fs.readFileSync(latestPath, 'utf8');
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(payload);
        } catch (error) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            error: 'dashboard read-model latest.json not found',
            contract_type: match[1],
            latest_path: latestPath,
          }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dashboardReadModelApi()],
});
