import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';

const DEFAULT_STORAGE_ROOT = '/root/projects/trading-storage/storage';
const SAFE_CONTRACT_RE = /^[a-z][a-z0-9_]*$/;
const SAFE_TABLE_ID_RE = /^[a-z][a-z0-9_]*$/;
const SAFE_MONTH_RE = /^\d{4}-\d{2}$/;
const SAFE_LAYER_ID_RE = /^model_0[1-5]_[a-z0-9_]+$/;
const DASHBOARD_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REGISTERED_READ_MODELS = new Set([
  'current_system_status_summary',
  'alert_exception_summary',
  'historical_task_progress_summary',
  'temporal_explorer_summary',
  'realtime_task_progress_summary',
  'model_readiness_summary',
  'model_promotion_posture_summary',
  'model_group_replay_review_summary',
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
  return path.join(storageRoot(), '06_dashboard_cache', 'read_models', `${canonicalContractType(contractType)}.json`);
}

function validateReadModelPayload(payload: unknown, expectedContractType: string): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('dashboard read-model current payload must be a JSON object');
  }
  const record = payload as Record<string, unknown>;
  const missing = REQUIRED_READ_MODEL_FIELDS.filter((field) => !(field in record));
  if (missing.length) {
    throw new Error(`missing required dashboard read-model fields: ${missing.join(', ')}`);
  }
  if (canonicalContractType(String(record.contract_type)) !== expectedContractType) {
    throw new Error(`current payload contract_type does not match expected ${expectedContractType}`);
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

function recordValue(record: unknown, key: string): unknown {
  return record && typeof record === 'object' && !Array.isArray(record) ? (record as Record<string, unknown>)[key] : undefined;
}

function nestedValue(record: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((current, key) => recordValue(current, key), record);
}

function safeStoragePath(value: unknown): string {
  const rawPath = String(value ?? '');
  if (!rawPath) throw new Error('missing replay artifact path');
  const resolved = path.resolve(rawPath);
  const root = path.resolve(storageRoot());
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('replay artifact path is outside dashboard storage root');
  }
  return resolved;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

const ETF_SYMBOLS = new Set([
  'AIQ',
  'ARKF',
  'ARKG',
  'ARKW',
  'ARKX',
  'BITW',
  'BKCH',
  'CIBR',
  'CPER',
  'DBA',
  'DBC',
  'DIA',
  'GLD',
  'HYG',
  'IEF',
  'IGV',
  'IWM',
  'IYT',
  'LQD',
  'QQQ',
  'RSP',
  'SHY',
  'SLV',
  'SMH',
  'SPY',
  'TLT',
  'USO',
  'UUP',
  'VIXY',
  'XBI',
  'XLB',
  'XLC',
  'XLE',
  'XLF',
  'XLI',
  'XLK',
  'XLP',
  'XLRE',
  'XLU',
  'XLV',
  'XLY',
  'XME',
  'XOP',
  'XRT',
]);

function replayInstrumentType(row: Record<string, unknown>): string {
  const selectedOption = stringOrNull(row.selected_option_contract_ref);
  const expressionType = stringOrNull(row.selected_option_expression_type);
  const optionRoute = stringOrNull(row.asset_expression_route);
  if (
    selectedOption
    || (expressionType && expressionType !== 'underlying_only_expression')
    || optionRoute === 'option_expression_filled'
  ) {
    return 'Option';
  }
  const assetClass = stringOrNull(row.asset_class);
  if (assetClass === 'crypto_spot' || assetClass === 'crypto') return 'Crypto';
  const target = String(row.target_ref ?? row.target_symbol ?? row.instrument_ref ?? '').toUpperCase();
  if (ETF_SYMBOLS.has(target)) return 'ETF';
  if (assetClass === 'us_equity' || assetClass === 'equity') return 'Stock';
  return assetClass ? assetClass.replace(/_/g, ' ') : 'Unknown';
}

function versionStableId(record: Record<string, unknown>, index: number): string {
  return String(record.version_id ?? record.candidate_model_ref ?? record.promotion_run_id ?? index);
}

function replayDecisionReasonCodes(row: Record<string, unknown>): string[] {
  const candidates = [
    row.reason_codes,
    row.decision_reason_codes,
    nestedValue(row, 'model_layer_diagnostics', 'model_03_event_state', 'reason_codes'),
    nestedValue(row, 'model_layer_diagnostics', 'm03_event_effect_evidence', 'reason_codes'),
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map((item) => String(item)).filter(Boolean).slice(0, 8);
  }
  return [];
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(stringList);
  }
  return value === null || value === undefined || value === '' ? [] : [String(value)];
}

function replayTraceStep(
  componentId: string,
  component_label: string,
  decision: unknown,
  fields: Record<string, unknown>,
): Record<string, unknown> | null {
  const normalizedDecision = stringOrNull(decision);
  const reasonCodes = stringList(fields.reason_codes).slice(0, 8);
  const hardGateReasonCodes = stringList(fields.hard_gate_reason_codes).slice(0, 8);
  const status = stringOrNull(fields.status ?? fields.alpha_gate_status ?? fields.resolved_event_failure_risk_status);
  const score = numberOrNull(fields.score ?? fields.resolved_alpha_score ?? nestedValue(fields, 'dominant_horizon_scores', 'action_confidence_score'));
  const side = stringOrNull(fields.side ?? fields.resolved_action_side);
  const action = stringOrNull(fields.action ?? fields.resolved_underlying_action_type);
  if (!normalizedDecision && !status && score === null && !side && !action && !reasonCodes.length && !hardGateReasonCodes.length) {
    return null;
  }
  return {
    component_id: componentId,
    component_label,
    decision: normalizedDecision,
    status,
    score,
    side,
    action,
    reason_codes: [...reasonCodes, ...hardGateReasonCodes].slice(0, 8),
  };
}

function replayDecisionTrace(row: Record<string, unknown>): Record<string, unknown>[] {
  const diagnostics = recordValue(row, 'model_layer_diagnostics');
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) return [];
  const diagnosticRecord = diagnostics as Record<string, unknown>;
  const trace = [
    replayTraceStep(
      'component_02_entry',
      'C02 Entry',
      stringOrNull(row.decision_status ?? row.status),
      {
        status: row.entry_threshold_calibration_status,
        score: row.prediction_score,
        action: row.decision_action ?? row.action,
        reason_codes: row.decision_reason_codes ?? row.reason_codes,
      },
    ),
    replayTraceStep(
      'model_05_alpha_confidence',
      'M04 Alpha Confidence',
      nestedValue(diagnosticRecord, 'model_05_alpha_confidence', 'alpha_gate_status'),
      recordValue(diagnosticRecord, 'model_05_alpha_confidence') as Record<string, unknown> ?? {},
    ),
    replayTraceStep(
      'model_04_unified_decision',
      'M04 Unified Decision',
      nestedValue(diagnosticRecord, 'model_04_unified_decision', 'resolved_underlying_action_type'),
      recordValue(diagnosticRecord, 'model_04_unified_decision') as Record<string, unknown> ?? {},
    ),
    replayTraceStep(
      'model_04_event_failure_risk',
      'M04 Event Failure Risk',
      nestedValue(diagnosticRecord, 'model_04_event_failure_risk', 'resolved_event_failure_risk_status'),
      recordValue(diagnosticRecord, 'model_04_event_failure_risk') as Record<string, unknown> ?? {},
    ),
    replayTraceStep(
      'model_03_event_state',
      'M03 Event State',
      nestedValue(diagnosticRecord, 'model_03_event_state', 'decision_status'),
      recordValue(diagnosticRecord, 'model_03_event_state') as Record<string, unknown> ?? {},
    ),
    replayTraceStep(
      'm03_event_effect_evidence',
      'M03 Event Effect Evidence',
      nestedValue(diagnosticRecord, 'm03_event_effect_evidence', 'decision_status'),
      recordValue(diagnosticRecord, 'm03_event_effect_evidence') as Record<string, unknown> ?? {},
    ),
  ].filter((step): step is Record<string, unknown> => Boolean(step));
  const evidenceChain = Array.isArray(row.model_evidence_chain) ? row.model_evidence_chain.map(String) : [];
  const existing = new Set(trace.map((step) => String(step.component_id)));
  for (const componentId of evidenceChain) {
    if (existing.has(componentId)) continue;
    trace.push({
      component_id: componentId,
      component_label: componentId.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      decision: 'evidence_used',
      status: 'referenced',
      score: null,
      side: null,
      action: null,
      reason_codes: [],
    });
  }
  return trace;
}

function sanitizeReplayDecisionRow(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const realized = numberOrNull(row.net_return) ?? numberOrNull(row.realized_return) ?? numberOrNull(row.candidate_return);
  const cost = numberOrNull(row.cost) ?? numberOrNull(row.trading_cost) ?? 0;
  return {
    row_index: index,
    decision_id: stringOrNull(row.decision_id),
    timestamp: stringOrNull(row.timestamp ?? row.decision_timestamp),
    target_ref: stringOrNull(row.target_ref ?? row.target_symbol),
    instrument_type: replayInstrumentType(row),
    action: stringOrNull(row.decision_action ?? row.action),
    disposition: stringOrNull(row.decision_disposition ?? row.decision_status ?? row.status),
    fill_status: stringOrNull(row.fill_status ?? row.replay_fill_status),
    score: numberOrNull(row.prediction_score ?? row.predicted_score ?? row.probability ?? row.confidence_score ?? row.alpha_score ?? row.rank_score),
    outcome_label: stringOrNull(row.outcome_label ?? row.label ?? row.realized_label),
    realized_return: realized,
    baseline_return: numberOrNull(row.baseline_return ?? row.replay_return ?? row.incumbent_return),
    cost,
    net_return: realized === null ? null : realized - cost,
    reason_codes: replayDecisionReasonCodes(row),
    decision_trace: replayDecisionTrace(row),
  };
}

function replayDecisionRows(versionId: string, month: string): Record<string, unknown> {
  const snapshot = readLatestPayload('model_promotion_posture_summary');
  const chartPayload = snapshot.payload.chart_payload as Record<string, unknown>;
  const versions = Array.isArray(chartPayload.group_versions) ? chartPayload.group_versions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
  const version = versions.find((item, index) => versionStableId(item, index) === versionId);
  if (!version) throw new Error('unknown replay model version');
  const refs = recordValue(version, 'refs');
  const settlementPath = safeStoragePath(recordValue(refs, 'settlement_ref'));
  const settlement = JSON.parse(fs.readFileSync(settlementPath, 'utf8')) as Record<string, unknown>;
  const receiptPath = safeStoragePath(settlement.replay_result_ref);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
  const decisionRowsPath = safeStoragePath(receipt.decision_rows_ref);
  const rows: Record<string, unknown>[] = [];
  let totalMonthRows = 0;
  for (const line of fs.readFileSync(decisionRowsPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Record<string, unknown>;
    const timestamp = String(row.timestamp ?? row.decision_timestamp ?? '');
    if (timestamp.slice(0, 7) !== month) continue;
    if (String(row.entry_threshold_calibration_role ?? 'test') === 'validation') continue;
    totalMonthRows += 1;
    rows.push(sanitizeReplayDecisionRow(row, totalMonthRows));
  }
  return {
    version_id: versionId,
    version_label: version.version_label ?? versionId,
    month,
    total_month_rows: totalMonthRows,
    returned_rows: rows.length,
    rows,
  };
}

function comparableValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value ?? '');
}

async function replayLayerDecisionRows(query: {
  reviewRunId: string;
  layerId: string;
  offset: number;
  limit: number;
  sort: string;
  direction: string;
}): Promise<Record<string, unknown>> {
  if (!query.reviewRunId || query.reviewRunId.length > 200 || !SAFE_LAYER_ID_RE.test(query.layerId)) {
    throw new Error('invalid replay layer decision query');
  }
  const snapshot = readLatestPayload('model_group_replay_review_summary');
  const chartPayload = snapshot.payload.chart_payload as Record<string, unknown>;
  const runs = Array.isArray(chartPayload.review_runs)
    ? chartPayload.review_runs.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
  const run = runs.find((item) => String(item.review_run_id ?? '') === query.reviewRunId);
  if (!run) throw new Error('unknown replay review run');
  const sourceRefs = recordValue(run, 'source_refs');
  const rowsPath = safeStoragePath(recordValue(sourceRefs, 'layer_review_rows_ref'));
  const rows: Record<string, unknown>[] = [];
  const reader = readline.createInterface({
    input: fs.createReadStream(rowsPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Record<string, unknown>;
    if (String(row.layer_id ?? '') === query.layerId) rows.push(row);
  }
  const sortKey = /^[a-zA-Z0-9_]+$/.test(query.sort) ? query.sort : 'decision_time';
  const direction = query.direction === 'desc' ? 'desc' : 'asc';
  rows.sort((left, right) => {
    const leftValue = comparableValue(left[sortKey]);
    const rightValue = comparableValue(right[sortKey]);
    const result = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    return direction === 'asc' ? result : -result;
  });
  const offset = Number.isFinite(query.offset) ? Math.max(0, query.offset) : 0;
  const limit = Number.isFinite(query.limit) ? Math.max(1, Math.min(250, query.limit)) : 50;
  return {
    review_run_id: query.reviewRunId,
    layer_id: query.layerId,
    total_rows: rows.length,
    returned_rows: Math.max(0, Math.min(limit, rows.length - offset)),
    offset,
    limit,
    sort: sortKey,
    direction,
    rows: rows.slice(offset, offset + limit),
  };
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
        error: error instanceof Error ? error.message : 'dashboard read-model current file not found',
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

function attachDashboardReplayDecisionApi(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use('/api/replay-decisions', (req, res) => {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    void (async () => {
      try {
        const version = parsedUrl.searchParams.get('version') ?? '';
        const month = parsedUrl.searchParams.get('month') ?? '';
        if (!version || version.length > 400 || !SAFE_MONTH_RE.test(month)) {
          sendJson(res, 400, { error: 'invalid replay decision query' });
          return;
        }
        sendJson(res, 200, replayDecisionRows(version, month));
      } catch (error) {
        sendJson(res, 404, { error: error instanceof Error ? error.message : 'replay decision rows unavailable' });
      }
    })();
  });
}

function attachDashboardReplayLayerDecisionApi(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use('/api/replay-layer-decisions', (req, res) => {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    void (async () => {
      try {
        sendJson(res, 200, await replayLayerDecisionRows({
          reviewRunId: parsedUrl.searchParams.get('review_run_id') ?? '',
          layerId: parsedUrl.searchParams.get('layer_id') ?? '',
          offset: Number(parsedUrl.searchParams.get('offset') ?? '0'),
          limit: Number(parsedUrl.searchParams.get('limit') ?? '50'),
          sort: parsedUrl.searchParams.get('sort') ?? 'decision_time',
          direction: parsedUrl.searchParams.get('direction') ?? 'asc',
        }));
      } catch (error) {
        sendJson(res, 404, { error: error instanceof Error ? error.message : 'replay layer decision rows unavailable' });
      }
    })();
  });
}

function dashboardReadModelApi(): Plugin {
  return {
    name: 'dashboard-read-model-api',
    configureServer(server) {
      attachDashboardReadModelApi(server);
      attachDashboardDataTableApi(server);
      attachDashboardReplayDecisionApi(server);
      attachDashboardReplayLayerDecisionApi(server);
    },
    configurePreviewServer(server) {
      attachDashboardReadModelApi(server);
      attachDashboardDataTableApi(server);
      attachDashboardReplayDecisionApi(server);
      attachDashboardReplayLayerDecisionApi(server);
    },
  };
}

export default defineConfig({
  plugins: [react(), dashboardReadModelApi()],
});
