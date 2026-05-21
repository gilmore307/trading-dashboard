import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StatusPill } from './components';
import { fetchDataTableCatalog, fetchDataTableRows, type DataTableQueryResult, type DataTableSpec } from './dataTables';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel, openLatestReadModelSocket, type ReadModelStreamStatus } from './readModels';
import type {
  AgentErrorSummaryPayload,
  CurrentSystemSourceOutputPayload,
  CurrentSystemServicePayload,
  CurrentSystemStatusChartPayload,
  DashboardReadModel,
  HistoricalTaskProgressChartPayload,
  HistoricalTaskTimelineItemPayload,
  RealtimeSignalChartPayload,
} from './types';
import './styles.css';

const CURRENT_SYSTEM_STATUS = 'current_system_status_summary';
const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary';
const REALTIME_SIGNAL_SUMMARY = 'realtime_signal_summary';

const SOURCE_LABELS: Record<string, string> = {
  'trading-storage': 'System Monitor',
  'trading-manager': 'Task Manager',
};

const SERVICE_LABELS: Record<string, string> = {
  'trading-dashboard-web.service': 'Dashboard Web UI',
  'trading-manager-historical-scheduler.service': 'Historical Training Automation',
  'trading-execution-realtime-monitor-loop.service': 'Realtime Monitor Loop',
  'trading-data-te-calendar-refresh.service': 'Trading Economics Calendar Worker',
  'trading-execution-realtime-runtime-check.service': 'Realtime Runtime Check Worker',
  'trading-data-te-calendar-refresh.timer': 'Trading Economics Calendar Schedule',
  'trading-execution-realtime-runtime-check.timer': 'Realtime Runtime Check Schedule',
  'trading-execution-realtime-runtime-check.path': 'Realtime Runtime Check Watcher',
  'trading-storage-dashboard-read-model-refresh.timer': 'Dashboard Refresh Schedule',
  'trading-storage-dashboard-read-model-refresh.service': 'Dashboard Refresh Worker',
};

const BACKGROUND_SERVICE_DISPLAY_ORDER: Record<string, number> = {
  'trading-dashboard-web.service': 10,
  'trading-storage-dashboard-read-model-refresh.timer': 20,
  'trading-storage-dashboard-read-model-refresh.service': 30,
  'trading-manager-historical-scheduler.service': 40,
  'trading-execution-realtime-monitor-loop.service': 50,
  'trading-execution-realtime-runtime-check.path': 60,
  'trading-execution-realtime-runtime-check.timer': 70,
  'trading-execution-realtime-runtime-check.service': 80,
};

const DASHBOARD_DATA_DISPLAY_ORDER: Record<string, number> = {
  storage_dashboard_current_status_latest: 10,
  storage_dashboard_historical_task_progress_latest: 20,
  storage_dashboard_realtime_signal_latest: 30,
  storage_dashboard_execution_runtime_latest: 40,
  storage_dashboard_read_model_index: 50,
  manager_scheduler_state: 100,
  manager_scheduler_decision_log: 110,
  manager_workflow_state: 120,
  manager_stage_coverage: 130,
  manager_stage_run_dashboard: 140,
  execution_runtime_status: 200,
  execution_realtime_monitor_receipt: 210,
  execution_realtime_monitor_cycle: 220,
  trading_economics_calendar_receipt: 300,
  trading_economics_calendar_events: 310,
  trading_economics_historical_seed_receipt: 320,
};

type ViewId = 'status' | 'tasks' | 'data' | 'diagnostics' | 'models' | 'registry' | 'realtime' | 'performance';

const navItems: Array<{ id: ViewId; label: string; state: string }> = [
  { id: 'status', label: 'Current Status', state: 'Live' },
  { id: 'tasks', label: 'Tasks', state: 'Task list' },
  { id: 'data', label: 'Data', state: 'Data + model outputs' },
  { id: 'models', label: 'Models', state: 'Historical modeling' },
  { id: 'registry', label: 'Definitions', state: 'Coming soon' },
  { id: 'realtime', label: 'Realtime Signals', state: 'Shadow monitor' },
  { id: 'performance', label: 'Trading Performance', state: 'Coming soon' },
  { id: 'diagnostics', label: 'Diagnostics', state: 'Error summary' },
];

function isHistoricalChart(payload: DashboardReadModel['chart_payload']): payload is HistoricalTaskProgressChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isRealtimeSignalChart(payload: DashboardReadModel['chart_payload']): payload is RealtimeSignalChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function safeRefLabel(ref: unknown, fallback: string): string {
  if (typeof ref !== 'object' || ref === null) return fallback;
  if ('ref_type' in ref) return startCase(String(ref.ref_type));
  if ('kind' in ref) return startCase(String(ref.kind));
  if ('status' in ref) return startCase(String(ref.status));
  return fallback;
}

function publicSourceLabel(sourceSystem?: string | null): string {
  if (!sourceSystem) return 'Dashboard System';
  return SOURCE_LABELS[sourceSystem] ?? startCase(sourceSystem);
}

function publicServiceLabel(unit?: string | null): string {
  if (!unit) return 'System Service';
  return SERVICE_LABELS[unit] ?? startCase(unit.replace(/\.(service|timer|path)$/u, ''));
}

function serviceDisplayRank(service: CurrentSystemServicePayload): number {
  return BACKGROUND_SERVICE_DISPLAY_ORDER[service.unit] ?? 900;
}

function dashboardDataDisplayRank(output: CurrentSystemSourceOutputPayload): number {
  return DASHBOARD_DATA_DISPLAY_ORDER[output.kind ?? ''] ?? 900;
}

function compareDisplayRank<T>(left: T, right: T, rankFor: (value: T) => number, labelFor: (value: T) => string): number {
  const rankDelta = rankFor(left) - rankFor(right);
  return rankDelta || labelFor(left).localeCompare(labelFor(right));
}

function apiStatusLabel(status?: string | null): string {
  if (status === 'connected') return 'Connected';
  if (status === 'configured') return 'Configured';
  if (status === 'not_configured') return 'Not configured';
  if (status === 'local_service_online') return 'Local service online';
  if (status === 'local_service_offline') return 'Local service offline';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'refreshing') return 'Refreshing';
  if (status === 'idle') return 'Idle';
  if (status === 'disabled') return 'Disabled';
  if (status === 'missing_output') return 'Missing output';
  return startCase(status);
}

function apiIsHealthy(status?: string | null): boolean {
  return status === 'connected' || status === 'configured' || status === 'available' || status === 'scheduled' || status === 'refreshing' || status === 'idle' || status === 'local_service_online';
}

function serviceIsHealthyForDisplay(service: CurrentSystemServicePayload): boolean {
  if (service.healthy === false) return false;
  if (service.healthy === true) return true;
  if (service.active_state === 'active') return true;
  if (service.unit === 'trading-storage-dashboard-read-model-refresh.service') {
    return service.active_state === 'activating' || (service.active_state === 'inactive' && service.result === 'success');
  }
  return false;
}

function serviceStatusLabel(service: CurrentSystemServicePayload): string {
  if (service.healthy === false) return 'Needs attention';
  if (service.active_state === 'activating' && service.substate === 'auto-restart' && service.result === 'success') return 'Cycling';
  if (service.unit === 'trading-storage-dashboard-read-model-refresh.service' && service.active_state === 'activating') return 'Refreshing';
  if (service.unit_kind === 'timer' && service.active_state === 'active') return 'Scheduled';
  if (service.unit_kind === 'path' && service.active_state === 'active') return 'Watching';
  if (service.unit_type === 'oneshot' && service.active_state === 'inactive' && service.result === 'success') return 'Idle';
  if (service.enabled_state === 'disabled' && service.active_state === 'inactive') return 'Disabled';
  if (service.active_state === 'active') return 'Running';
  if (service.active_state === 'activating') return 'Starting';
  if (service.active_state === 'inactive') return 'Stopped';
  return startCase(service.active_state);
}
function formatAgeSeconds(ageSeconds?: number | null): string {
  if (typeof ageSeconds !== 'number' || !Number.isFinite(ageSeconds)) return 'age unknown';
  if (ageSeconds < 60) return `${Math.round(ageSeconds)}s ago`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m ago`;
  return `${Math.round(ageSeconds / 3600)}h ago`;
}

function sourceOutputStatus(output: { exists: boolean; status: string; latest_updated_at_utc?: string | null; age_seconds?: number | null }): string {
  if (!output.exists) return 'Missing';
  if (!output.latest_updated_at_utc) return startCase(output.status);
  return `${formatTimestamp(output.latest_updated_at_utc)} · ${formatAgeSeconds(output.age_seconds)}`;
}

function sourceOutputFreshnessLabel(freshnessClass?: string | null): string {
  if (freshnessClass === 'heartbeat') return 'Heartbeat source';
  if (freshnessClass === 'event_driven') return 'Event-driven source';
  return 'Source artifact';
}

function formatPercent(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : '0.0%';
}

function formatNetworkRate(kbps?: number | null): string {
  if (typeof kbps !== 'number' || !Number.isFinite(kbps)) return '0 KB/s';
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
}

function sumStageCounts(counts?: Record<string, number>): number {
  return Object.values(counts ?? {}).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function terminalStageCount(counts?: Record<string, number>): number {
  return (counts?.succeeded ?? 0) + (counts?.not_applicable ?? 0);
}

function workflowGateLabel(ok?: boolean | null): string {
  if (ok === true) return 'Ready';
  if (ok === false) return 'Blocked';
  return 'Unknown';
}

function providerPostureIsOk(status?: string | null): boolean {
  return status === 'ready' || status === 'available' || status === 'no_provider_work_selected' || status === 'not_required' || status === 'idle';
}

function signalStatusSeverity(status?: string | null): string {
  const normalized = String(status ?? '').toLowerCase();
  if (['unsafe', 'failed', 'violation'].includes(normalized)) return 'critical';
  if (['degraded', 'blocked', 'unknown'].includes(normalized)) return 'medium';
  if (['safe', 'shadow_ready', 'observed', 'ready_for_fixture_or_shadow_model_decision_input', 'ready_for_historical_model_decision_handoff'].includes(normalized)) return 'low';
  return 'info';
}

function displayValue(value: unknown): string | number {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function sanitizedRefSummary(ref: unknown): string {
  if (typeof ref !== 'object' || ref === null) return String(ref);
  const record = ref as Record<string, unknown>;
  const parts: string[] = [];
  if ('status' in record) parts.push(`Status: ${startCase(String(record.status))}`);
  if ('generated_at_utc' in record) parts.push(`Generated: ${formatTimestamp(String(record.generated_at_utc))}`);
  if ('source_system' in record) parts.push(`Source: ${publicSourceLabel(String(record.source_system))}`);
  return parts.length ? parts.join(' · ') : 'Reference available for diagnostics.';
}

function diagnosticText(value: unknown, fallback = 'Diagnostic evidence attached.'): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) {
    const parts = value.map((item) => diagnosticText(item, '')).filter(Boolean);
    return parts.length ? parts.join(' · ') : fallback;
  }
  const record = maybeRecord(value);
  for (const field of ['summary', 'message', 'reason', 'detail', 'description', 'root_cause']) {
    const candidate = record[field];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return sanitizedRefSummary(value);
}

type DiagnosticSeverity = 'critical' | 'error' | 'warning' | 'notice';
type DiagnosticHandlingStatus = 'open' | 'closed' | 'no_action_required' | 'awaiting_retry' | 'manual_review';

type DiagnosticSummaryItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  detail: string;
  severity: DiagnosticSeverity;
  handlingStatus: DiagnosticHandlingStatus;
  errorRef?: string | null;
  displayRef?: string | null;
  occurredAt?: string | null;
};

function refDetail(ref: unknown): string {
  if (typeof ref !== 'object' || ref === null) return String(ref);
  const record = ref as Record<string, unknown>;
  const detailParts = ['issue_type', 'unit', 'stage_id', 'status', 'path', 'receipt_path', 'stderr_path', 'generated_utc']
    .filter((field) => record[field] !== undefined && record[field] !== null)
    .map((field) => `${startCase(field)}: ${String(record[field])}`);
  return detailParts.length ? detailParts.join(' · ') : 'Reference attached for agent follow-up.';
}

function refTitle(ref: unknown, fallback: string): string {
  if (typeof ref !== 'object' || ref === null) return fallback;
  const record = ref as Record<string, unknown>;
  if (record.ref_type) return startCase(String(record.ref_type));
  if (record.contract_type) return startCase(String(record.contract_type));
  if (record.issue_type) return startCase(String(record.issue_type));
  if (record.kind) return startCase(String(record.kind));
  return fallback;
}

function diagnosticSeverityRank(severity: DiagnosticSeverity): number {
  return { critical: 0, error: 1, warning: 2, notice: 3 }[severity];
}

function handlingStatusLabel(status: DiagnosticHandlingStatus): string {
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Closed';
  if (status === 'awaiting_retry') return 'Awaiting retry';
  if (status === 'manual_review') return 'Manual review';
  return 'No action needed';
}

function diagnosticSeverityLabel(severity: DiagnosticSeverity): string {
  if (severity === 'critical') return 'Critical';
  if (severity === 'error') return 'Error';
  if (severity === 'warning') return 'Warning';
  return 'Notice';
}

function diagnosticSeverityFromValue(value: unknown): DiagnosticSeverity {
  const severity = String(value ?? '').toLowerCase();
  if (severity === 'critical') return 'critical';
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  return 'notice';
}

function diagnosticHandlingFromValue(value: unknown): DiagnosticHandlingStatus {
  const status = String(value ?? '').toLowerCase();
  if (status === 'closed') return 'closed';
  if (status === 'no_action_required') return 'no_action_required';
  if (status === 'awaiting_retry') return 'awaiting_retry';
  if (status === 'manual_review') return 'manual_review';
  return 'open';
}

function agentRunnerLabel(runnerCommand: unknown): string {
  const runner = String(runnerCommand ?? '').toLowerCase();
  if (runner.includes('openclaw_agent') || runner.includes('run_agent_error_agent.py')) return 'Agent';
  if (runner.includes('safe_error_repair') || runner.includes('run_safe_error_repair.py')) return 'Safe repair';
  if (!runner.trim()) return 'Agent';
  return 'Repair runner';
}

function agentInterventionStatus(diagnosisStatus: unknown, repairStatus: unknown, runnerCommand: unknown): string {
  const diagnosis = String(diagnosisStatus ?? '').toLowerCase();
  const repair = String(repairStatus ?? '').toLowerCase();
  const reviewed = diagnosis === 'completed';
  const runnerLabel = agentRunnerLabel(runnerCommand);
  if (repair === 'repaired') return reviewed ? `${runnerLabel} repaired` : 'Repair recorded';
  if (repair === 'superseded') return 'Superseded by current route';
  if (repair === 'not_supported') return reviewed ? `${runnerLabel} reviewed · Not supported` : 'Not supported';
  if (repair === 'queued') return `${runnerLabel} queued`;
  if (repair === 'agent_call_failed') return `${runnerLabel} call failed`;
  if (repair === 'repair_attempted') return `${runnerLabel} attempted repair`;
  if (repair === 'diagnosed') return `${runnerLabel} diagnosed`;
  if (reviewed) return `${runnerLabel} reviewed`;
  return startCase(repair || diagnosis || 'unknown');
}

function agentHandlingStatus(error: AgentErrorSummaryPayload): DiagnosticHandlingStatus {
  const repair = String(error.repair_status ?? '').toLowerCase();
  if (repair === 'not_supported') return 'manual_review';
  return diagnosticHandlingFromValue(error.handling_status);
}

function stableHashHex(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function stableDiagnosticId(prefix: string, value: string, index = 0): string {
  const raw = `${prefix}-${value}-${index}`;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 64);
  return normalized ? `${prefix}-${stableHashHex(raw)}-${normalized}` : `${prefix}-${stableHashHex(raw)}`;
}

function stableDiagnosticKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableDiagnosticKey).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${key}:${stableDiagnosticKey((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function diagnosticRefIdentity(ref: unknown, fallback: string): string {
  const record = maybeRecord(ref);
  const stableFields = [
    'issue_id',
    'issue_ref',
    'ref_id',
    'path',
    'stage_id',
    'task_id',
    'unit',
    'ref_type',
    'contract_type',
    'issue_type',
    'kind',
  ];
  const parts = stableFields
    .filter((field) => record[field] !== undefined && record[field] !== null)
    .map((field) => `${field}=${String(record[field])}`);
  return parts.length ? parts.join('|') : stableDiagnosticKey(ref) || fallback;
}

function diagnosticGeneratedPrefix(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('service')) return 'SVC';
  if (normalized.includes('source')) return 'SRC';
  if (normalized.includes('read model')) return 'READMODEL';
  if (normalized.includes('dashboard data')) return 'DATA';
  if (normalized.includes('issue')) return 'ISSUE';
  if (normalized.includes('task')) return 'TASK';
  return 'DIAG';
}

function diagnosticReference(item: DiagnosticSummaryItem): string {
  return item.displayRef || item.errorRef || `${diagnosticGeneratedPrefix(item.category)}-${stableHashHex(item.id)}`;
}

function maybeRecord(ref: unknown): Record<string, unknown> {
  return typeof ref === 'object' && ref !== null ? ref as Record<string, unknown> : {};
}

function taskStateSeverity(state?: string | null): string {
  if (state === 'completed' || state === 'skipped') return 'low';
  if (state === 'current') return 'info';
  if (state === 'failed') return 'medium';
  return 'info';
}

function taskStateLabel(task: HistoricalTaskTimelineItemPayload): string {
  if (task.task_state === 'current') return 'Now';
  if (task.task_state === 'completed') return 'Past';
  if (task.task_state === 'future') return 'Future';
  if (task.task_state === 'failed') return 'Failed';
  if (task.task_state === 'skipped') return 'Skipped';
  return startCase(task.task_state);
}

function layerLabel(task: HistoricalTaskTimelineItemPayload): string {
  if (typeof task.layer === 'number') return `Layer ${task.layer}`;
  return task.layer_key ? startCase(task.layer_key) : 'General';
}

function taskLayerFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  if (typeof task.layer === 'number') return String(task.layer);
  return task.layer_key ?? 'general';
}

function taskWorkTypeFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  return task.stage_type ?? task.task_label ?? 'unknown';
}

function taskWorkerFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  return task.worker_id || task.detail?.worker?.worker_id || task.worker_label || task.detail?.worker?.worker_label || 'unassigned_worker';
}

function taskTargetSymbol(task: HistoricalTaskTimelineItemPayload): string | null {
  return task.target_symbol || task.detail?.dataset_unit?.target_symbol || null;
}

function taskTargetFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  const target = taskTargetSymbol(task);
  if (target) return target;
  if ((task.layer ?? 0) >= 3 || task.target_required || task.detail?.dataset_unit?.target_required) return 'target_pending';
  return 'not_targeted';
}

function taskTargetLabel(task: HistoricalTaskTimelineItemPayload): string {
  const target = taskTargetSymbol(task);
  if (target) return target;
  if ((task.layer ?? 0) >= 3 || task.target_required || task.detail?.dataset_unit?.target_required) return 'Target pending';
  return 'Market / sector panel';
}

function taskTargetMetaLabel(task: HistoricalTaskTimelineItemPayload): string | null {
  const target = taskTargetSymbol(task);
  if (target && (task.layer ?? 0) >= 3) return `Target ${target}`;
  return null;
}

function taskMonthFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  return task.month ?? 'unscheduled';
}

const TASK_STATE_FILTER_ORDER: Record<string, number> = {
  completed: 10,
  skipped: 20,
  failed: 30,
  current: 40,
  future: 50,
};

const WORK_TYPE_FILTER_ORDER: Record<string, number> = {
  data_acquisition: 10,
  feature_generation: 20,
  model_generation: 30,
  model_evaluation: 40,
  promotion_review: 50,
  promotion_review_preparation: 50,
  maintenance: 60,
};

function monthOptionRank(value: string): number {
  if (value === 'unscheduled') return Number.MAX_SAFE_INTEGER;
  const match = /^(\d{4}-\d{2})(?:\.\.(\d{4}-\d{2}))?$/u.exec(value);
  if (!match) return Number.MAX_SAFE_INTEGER - 1;
  const normalizedStart = Number(match[1].replace(/-/gu, ''));
  if (!Number.isFinite(normalizedStart)) return Number.MAX_SAFE_INTEGER - 1;
  return normalizedStart * 10 + (match[2] ? 1 : 0);
}

function layerOptionRank(value: string): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : Number.MAX_SAFE_INTEGER;
}

function taskStateOptionRank(value: string): number {
  return TASK_STATE_FILTER_ORDER[value] ?? Number.MAX_SAFE_INTEGER;
}

function workTypeOptionRank(value: string): number {
  return WORK_TYPE_FILTER_ORDER[value] ?? Number.MAX_SAFE_INTEGER;
}

function targetOptionRank(value: string): number {
  if (value === 'target_pending') return 80;
  if (value === 'not_targeted') return 90;
  return 10;
}

function uniqueTaskOptions(
  tasks: HistoricalTaskTimelineItemPayload[],
  valueFor: (task: HistoricalTaskTimelineItemPayload) => string,
  labelFor: (task: HistoricalTaskTimelineItemPayload) => string,
  rankFor?: (value: string) => number,
) {
  const options = new Map<string, { firstIndex: number; label: string; rank: number }>();
  tasks.forEach((task, index) => {
    const value = valueFor(task);
    if (!options.has(value)) {
      options.set(value, { firstIndex: index, label: labelFor(task), rank: rankFor?.(value) ?? Number.MAX_SAFE_INTEGER });
    }
  });
  return Array.from(options.entries())
    .sort(([, left], [, right]) => (left.rank - right.rank) || (left.firstIndex - right.firstIndex) || left.label.localeCompare(right.label))
    .map(([value, option]) => [value, option.label] as [string, string]);
}

function monthLabel(month?: string | null): string {
  return month || 'Unscheduled Month';
}

function groupTasksByMonth(tasks: HistoricalTaskTimelineItemPayload[]) {
  const groups = new Map<string, HistoricalTaskTimelineItemPayload[]>();
  tasks.forEach((task) => {
    const month = monthLabel(task.month);
    groups.set(month, [...(groups.get(month) ?? []), task]);
  });
  return Array.from(groups.entries());
}

type TaskOption = [string, string];

type TaskVirtualRow =
  | { kind: 'month'; key: string; month: string; count: number }
  | { kind: 'task'; key: string; task: HistoricalTaskTimelineItemPayload };

function taskRowKey(task: HistoricalTaskTimelineItemPayload): string {
  return task.task_uid || `${task.month ?? 'unknown'}-${task.task_id}-${task.task_number ?? task.sequence}`;
}

function flattenTaskRows(monthGroups: [string, HistoricalTaskTimelineItemPayload[]][]): TaskVirtualRow[] {
  return monthGroups.flatMap(([month, monthTasks]) => [
    { kind: 'month' as const, key: `month-${month}`, month, count: monthTasks.length },
    ...monthTasks.map((task) => ({ kind: 'task' as const, key: taskRowKey(task), task })),
  ]);
}

function taskVirtualRowHeight(row: TaskVirtualRow, expandedTasks: Set<string>): number {
  if (row.kind === 'month') return 56;
  return expandedTasks.has(row.key) ? 430 : 132;
}

function optionLabel(options: TaskOption[], value: string, fallback: string): string {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? fallback;
}

function findTypedOption(options: TaskOption[], text: string): TaskOption | null {
  const query = text.trim().toLowerCase();
  if (!query) return null;
  return (
    options.find(([value, label]) => value.toLowerCase() === query || label.toLowerCase() === query) ??
    options.find(([value, label]) => value.toLowerCase().includes(query) || label.toLowerCase().includes(query)) ??
    null
  );
}

function SearchableFilter({
  label,
  value,
  options,
  onChange,
  listId,
}: {
  label: string;
  value: string;
  options: TaskOption[];
  onChange: (value: string) => void;
  listId: string;
}) {
  const [inputValue, setInputValue] = useState(() => optionLabel(options, value, value));
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    setInputValue(optionLabel(options, value, value));
  }, [options, value]);
  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);
  const selectedLabel = optionLabel(options, value, value);
  const visibleOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    const selectedQuery = selectedLabel.trim().toLowerCase();
    const filtered = query && query !== selectedQuery
      ? options.filter(([optionValue, labelValue]) => optionValue.toLowerCase().includes(query) || labelValue.toLowerCase().includes(query))
      : options;
    return filtered.slice(0, 120);
  }, [inputValue, options, selectedLabel]);
  const selectOption = useCallback((selected: TaskOption) => {
    onChange(selected[0]);
    setInputValue(selected[1]);
    setIsOpen(false);
  }, [onChange]);
  const commitTypedValue = useCallback(() => {
    const selected = findTypedOption(options, inputValue);
    if (selected) selectOption(selected);
    else setInputValue(optionLabel(options, value, value));
  }, [inputValue, options, selectOption, value]);
  return (
    <label className="searchable-filter" ref={filterRef}>
      <span>{label}</span>
      <div className="searchable-filter-control">
        <input
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(commitTypedValue, 120)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitTypedValue();
            }
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'ArrowDown') setIsOpen(true);
          }}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-label={label}
          role="combobox"
        />
        <button
          aria-label={`Show ${label} options`}
          className="searchable-filter-toggle"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          ▾
        </button>
      </div>
      {isOpen ? (
        <div className="searchable-filter-menu" id={listId} role="listbox">
          {visibleOptions.length ? visibleOptions.map((option) => (
            <button
              className={option[0] === value ? 'selected' : ''}
              key={option[0]}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              role="option"
              type="button"
              aria-selected={option[0] === value}
            >
              {option[1]}
            </button>
          )) : <div className="searchable-filter-empty">No matching options</div>}
        </div>
      ) : null}
    </label>
  );
}

function timestampText(value?: string | null): string {
  return value ? formatTimestamp(value) : 'Not recorded';
}

function workerLabel(task: HistoricalTaskTimelineItemPayload): string {
  return task.worker_label || task.detail?.worker?.worker_label || 'Worker not assigned';
}

function taskProgressFallback(task: HistoricalTaskTimelineItemPayload): { percent: number; label: string; hint: string } {
  const status = String(task.status || '').toLowerCase();
  if (status === 'succeeded' || status === 'not_applicable') {
    return { percent: 100, label: '100% complete', hint: startCase(task.status) };
  }
  if (status === 'failed') {
    return { percent: 100, label: 'Failed', hint: task.reason || 'Task reached a terminal failure state.' };
  }
  if (status === 'running') {
    return { percent: 50, label: 'In progress', hint: task.reason || 'Task is currently running.' };
  }
  if (status === 'ready') {
    return { percent: 0, label: '0% · Ready', hint: task.reason || 'Task is ready but has not started.' };
  }
  if (status === 'blocked') {
    return { percent: 0, label: '0% · Blocked', hint: task.reason || 'Task is waiting on blockers.' };
  }
  return { percent: 0, label: startCase(task.status || 'Not started'), hint: task.reason || 'No execution progress recorded yet.' };
}

function TaskDetailPanel({ task }: { task: HistoricalTaskTimelineItemPayload }) {
  const detail = task.detail ?? {};
  const progress = detail.progress;
  const execution = detail.last_execution;
  const blockers = detail.blockers ?? [];
  const receipts = detail.receipt_refs ?? [];
  const progressPercent = progress?.expected_count ? ((progress.ready_count ?? 0) / progress.expected_count) * 100 : 0;
  const progressUnitLabel = progress?.unit_label || 'ready';
  const fallbackProgress = taskProgressFallback(task);
  const fallbackProgressPercent = Math.max(0, Math.min(100, fallbackProgress.percent));
  return (
    <div className="task-detail-panel">
      <div className="task-detail-grid">
        <div className="task-detail-card">
          <span>Task identity</span>
          <strong>{monthLabel(task.month)} · {layerLabel(task)} · {startCase(task.stage_type)}</strong>
          <small>{[task.task_id, taskTargetMetaLabel(task)].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="task-detail-card">
          <span>Status</span>
          <strong>{startCase(task.status)}</strong>
          <small>{task.reason || 'No current reason recorded.'}</small>
        </div>
        <div className="task-detail-card wide-detail">
          <span>Task timing</span>
          <div className="task-timestamp-grid">
            <small><b>Generated</b>{timestampText(task.created_at_utc)}</small>
            <small><b>Started</b>{timestampText(task.started_at_utc)}</small>
            <small><b>Ended</b>{timestampText(task.ended_at_utc)}</small>
            <small><b>Status updated</b>{timestampText(task.status_updated_at_utc ?? task.updated_at_utc)}</small>
          </div>
        </div>
        {progress ? (
          <div className="task-detail-card wide-detail">
            <span>Current progress</span>
            <strong>{formatPercent(progressPercent)} · {progress.ready_count ?? 0}/{progress.expected_count ?? 0} {progressUnitLabel}</strong>
            <div className="mini-progress" aria-label={`Task progress ${formatPercent(progressPercent)}`}>
              <div className="mini-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <small>Pending {progress.pending_count ?? 0} · Failed {progress.failed_count ?? 0} · Accepted skips {progress.accepted_failed_count ?? 0}</small>
          </div>
        ) : (
          <div className="task-detail-card wide-detail">
            <span>Current progress</span>
            <strong>{fallbackProgress.label}</strong>
            <div className="mini-progress" aria-label={`Task progress ${fallbackProgress.label}`}>
              <div className="mini-progress-fill" style={{ width: `${fallbackProgressPercent}%` }} />
            </div>
            <small>{fallbackProgress.hint}</small>
          </div>
        )}
        {execution ? (
          <div className="task-detail-card wide-detail">
            <span>Latest execution</span>
            <strong>{startCase(execution.status)}</strong>
            <small>{execution.return_code === undefined || execution.return_code === null ? 'No return code recorded' : `Return code ${execution.return_code}`}</small>
            {execution.reason ? <small>{execution.reason}</small> : null}
          </div>
        ) : null}
        <div className="task-detail-card">
          <span>Evidence</span>
          <strong>{receipts.length} receipt refs</strong>
          <small>{receipts.slice(0, 2).join(' · ') || 'No receipt refs attached.'}</small>
        </div>
        <div className="task-detail-card">
          <span>Blockers</span>
          <strong>{blockers.length} blockers</strong>
          {blockers.length ? blockers.slice(0, 3).map((blocker) => <code key={blocker}>{blocker}</code>) : <small>No blockers attached.</small>}
        </div>
      </div>
    </div>
  );
}

function collectDiagnosticSummary(
  currentStatusModel: DashboardReadModel | null,
  historicalModel: DashboardReadModel | null,
  systemChart: CurrentSystemStatusChartPayload,
  chart: HistoricalTaskProgressChartPayload,
): DiagnosticSummaryItem[] {
  const items: DiagnosticSummaryItem[] = [];
  const historicalSchedulerActive = (systemChart.services ?? []).some(
    (service) => service.unit === 'trading-manager-historical-scheduler.service' && service.active_state === 'active',
  );
  if (currentStatusModel && currentStatusModel.status !== 'healthy') {
    const severity = currentStatusModel.severity === 'critical' ? 'critical' : currentStatusModel.severity === 'high' ? 'error' : 'warning';
    items.push({
      id: stableDiagnosticId('read-model', CURRENT_SYSTEM_STATUS),
      title: 'Current Status read model',
      category: 'Read model',
      status: startCase(currentStatusModel.status),
      detail: currentStatusModel.summary,
      severity,
      handlingStatus: 'open',
      occurredAt: currentStatusModel.generated_at_utc,
    });
  }
  if (historicalModel && !['complete', 'healthy', 'ready', 'running'].includes(historicalModel.status)) {
    const severity = historicalModel.severity === 'critical' ? 'critical' : historicalModel.severity === 'high' ? 'error' : 'warning';
    items.push({
      id: stableDiagnosticId('read-model', HISTORICAL_TASK_PROGRESS),
      title: 'Historical task progress read model',
      category: 'Read model',
      status: startCase(historicalModel.status),
      detail: historicalModel.summary,
      severity,
      handlingStatus: 'open',
      occurredAt: historicalModel.generated_at_utc,
    });
  }
  (systemChart.services ?? []).filter((service) => service.healthy === false).forEach((service) => {
    items.push({
      id: stableDiagnosticId('service', service.unit),
      title: publicServiceLabel(service.unit),
      category: 'Service',
      status: startCase(service.active_state),
      detail: `Systemd unit ${service.unit} is ${service.active_state}${service.substate ? `/${service.substate}` : ''}.`,
      severity: service.active_state === 'failed' ? 'critical' : 'error',
      handlingStatus: 'open',
      occurredAt: currentStatusModel?.generated_at_utc,
    });
  });
  (systemChart.source_connections ?? systemChart.apis ?? []).filter((api) => api.healthy === false || (!api.healthy && !apiIsHealthy(api.status))).forEach((api) => {
    const optionalLocalOffline = api.status === 'local_service_offline';
    items.push({
      id: stableDiagnosticId('api', api.name),
      title: api.name,
      category: 'Source connection',
      status: apiStatusLabel(api.status),
      detail: `${api.kind ? startCase(api.kind) : 'Source connection'} is not currently reported as healthy.`,
      severity: optionalLocalOffline ? 'notice' : 'warning',
      handlingStatus: optionalLocalOffline ? 'no_action_required' : 'open',
      occurredAt: currentStatusModel?.generated_at_utc,
    });
  });
  (systemChart.source_outputs ?? []).filter((output) => {
    if (['not_started', 'not_recorded_yet'].includes(output.status)) return false;
    return output.status !== 'available' || !output.exists;
  }).forEach((output) => {
    items.push({
      id: stableDiagnosticId('source-output', output.label),
      title: output.label,
      category: 'Dashboard data',
      status: startCase(output.status),
      detail: output.freshness_note ?? sourceOutputStatus(output),
      severity: output.exists ? 'warning' : 'error',
      handlingStatus: 'open',
      occurredAt: output.latest_updated_at_utc ?? currentStatusModel?.generated_at_utc,
    });
  });
  (chart.task_timeline ?? []).filter((task) => task.task_state === 'failed' || String(task.status).toLowerCase() === 'failed').slice(0, 20).forEach((task) => {
    items.push({
      id: stableDiagnosticId('task', task.task_uid || `${task.month ?? 'unknown'}-${task.task_id}`),
      title: task.task_label,
      category: 'Task',
      status: 'Failed',
      detail: `${monthLabel(task.month)} · ${layerLabel(task)} · ${startCase(task.stage_type)}${task.reason ? ` · ${task.reason}` : ''}`,
      severity: 'error',
      handlingStatus: 'open',
      occurredAt: task.status_updated_at_utc ?? task.updated_at_utc ?? task.ended_at_utc,
    });
  });
  (chart.task_timeline ?? []).filter((task) => {
    const progress = task.detail?.progress;
    return progress && (progress.failed_count ?? 0) > 0 && progress.can_unlock_downstream !== true;
  }).slice(0, 20).forEach((task) => {
    const progress = task.detail?.progress;
    items.push({
      id: stableDiagnosticId('task-coverage', task.task_uid || `${task.month ?? 'unknown'}-${task.task_id}`),
      title: task.task_label,
      category: 'Task coverage',
      status: 'Action Required',
      detail: `${monthLabel(task.month)} · ${layerLabel(task)} · ${progress?.failed_count ?? 0}/${progress?.expected_count ?? 0} requests failed; downstream remains blocked.`,
      severity: 'error',
      handlingStatus: 'open',
      occurredAt: task.status_updated_at_utc ?? task.updated_at_utc ?? task.ended_at_utc,
    });
  });
  (chart.agent_error_summary ?? []).forEach((error) => {
    const errorRef = String(error.error_ref ?? '').trim();
    const repairStatus = agentInterventionStatus(error.diagnosis_status, error.repair_status, error.runner_command);
    const rootCause = diagnosticText(error.root_cause ?? error.summary, 'Agent error diagnosis recorded.');
    const retryRecommendation = diagnosticText(error.retry_recommendation, '');
    const retry = retryRecommendation ? ` · ${retryRecommendation}` : '';
    items.push({
      id: stableDiagnosticId('agent-error', errorRef || String(error.error_number ?? error.summary ?? 'unknown')),
      errorRef: errorRef || null,
      title: errorRef ? `${errorRef} ${startCase(String(error.error_kind ?? 'agent error'))}` : startCase(String(error.error_kind ?? 'Agent error')),
      category: 'Agent error',
      status: startCase(repairStatus),
      detail: `${rootCause}${retry}`,
      severity: diagnosticSeverityFromValue(error.dashboard_severity ?? error.severity),
      handlingStatus: agentHandlingStatus(error),
      occurredAt: error.occurred_at_utc ?? error.created_at_utc,
    });
  });
  [...(currentStatusModel?.issue_refs ?? []), ...(historicalModel?.issue_refs ?? [])].forEach((ref, index) => {
    const record = maybeRecord(ref);
    if (record.owner_action_required === false) return;
    const status = String(record.status ?? 'issue_ref');
    const closed = ['closed', 'resolved', 'complete', 'succeeded'].includes(status.toLowerCase());
    const identity = diagnosticRefIdentity(ref, `Issue ${index + 1}`);
    items.push({
      id: stableDiagnosticId('issue', identity),
      title: refTitle(ref, `Issue ${index + 1}`),
      category: 'Issue ref',
      status: startCase(status),
      detail: refDetail(ref),
      severity: closed ? 'notice' : 'warning',
      handlingStatus: closed ? 'closed' : 'open',
      occurredAt: String(record.generated_at_utc ?? record.generated_utc ?? '') || historicalModel?.generated_at_utc || currentStatusModel?.generated_at_utc,
    });
  });
  return items.sort((left, right) =>
    diagnosticSeverityRank(left.severity) - diagnosticSeverityRank(right.severity)
    || String(right.occurredAt ?? '').localeCompare(String(left.occurredAt ?? ''))
    || left.id.localeCompare(right.id),
  ).map((item, index) => ({
    ...item,
    displayRef: `ERR-${String(index + 1).padStart(6, '0')}`,
  }));
}

function TaskTimelineList({ tasks }: { tasks: HistoricalTaskTimelineItemPayload[] }) {
  const [monthFilter, setMonthFilter] = useState('auto');
  const [layerFilter, setLayerFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('auto');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const monthOptions = useMemo(() => uniqueTaskOptions(tasks, taskMonthFilterValue, (task) => monthLabel(task.month), monthOptionRank), [tasks]);
  const layerOptions = useMemo(() => uniqueTaskOptions(tasks, taskLayerFilterValue, layerLabel, layerOptionRank), [tasks]);
  const stateOptions = useMemo(() => uniqueTaskOptions(tasks, (task) => task.task_state, taskStateLabel, taskStateOptionRank), [tasks]);
  const workTypeOptions = useMemo(
    () => uniqueTaskOptions(tasks, taskWorkTypeFilterValue, (task) => startCase(task.stage_type || task.task_label), workTypeOptionRank),
    [tasks],
  );
  const workerOptions = useMemo(
    () => uniqueTaskOptions(tasks, taskWorkerFilterValue, workerLabel),
    [tasks],
  );
  const targetOptions = useMemo(
    () => uniqueTaskOptions(tasks, taskTargetFilterValue, taskTargetLabel, targetOptionRank),
    [tasks],
  );
  const hasCurrentTasks = useMemo(
    () => tasks.some((task) => task.task_state === 'current'),
    [tasks],
  );
  const latestTaskMonthValue = useMemo(() => {
    let selected = 'all';
    let selectedRank = -1;
    tasks.forEach((task) => {
      const value = taskMonthFilterValue(task);
      const rank = monthOptionRank(value);
      if (rank < Number.MAX_SAFE_INTEGER - 1 && rank > selectedRank) {
        selected = value;
        selectedRank = rank;
      }
    });
    return selected;
  }, [tasks]);
  const defaultStateFilter = hasCurrentTasks ? 'current' : 'all';
  const defaultMonthFilter = hasCurrentTasks ? 'all' : latestTaskMonthValue;
  const effectiveStateFilter = stateFilter === 'auto' ? defaultStateFilter : stateFilter;
  const effectiveMonthFilter = monthFilter === 'auto' ? defaultMonthFilter : monthFilter;
  const filteredTasks = useMemo(
    () => tasks.filter((task) => {
      if (effectiveMonthFilter !== 'all' && taskMonthFilterValue(task) !== effectiveMonthFilter) return false;
      if (layerFilter !== 'all' && taskLayerFilterValue(task) !== layerFilter) return false;
      if (effectiveStateFilter !== 'all' && task.task_state !== effectiveStateFilter) return false;
      if (workTypeFilter !== 'all' && taskWorkTypeFilterValue(task) !== workTypeFilter) return false;
      if (workerFilter !== 'all' && taskWorkerFilterValue(task) !== workerFilter) return false;
      if (targetFilter !== 'all' && taskTargetFilterValue(task) !== targetFilter) return false;
      return true;
    }),
    [effectiveMonthFilter, effectiveStateFilter, layerFilter, targetFilter, tasks, workerFilter, workTypeFilter],
  );
  const monthGroups = useMemo(() => groupTasksByMonth(filteredTasks), [filteredTasks]);
  const virtualRows = useMemo(() => flattenTaskRows(monthGroups), [monthGroups]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const virtualListRef = useRef<HTMLDivElement>(null);
  const virtualRowHeights = useMemo(
    () => virtualRows.map((row) => taskVirtualRowHeight(row, expandedTasks)),
    [expandedTasks, virtualRows],
  );
  const virtualOffsets = useMemo(() => {
    const offsets = [0];
    virtualRowHeights.forEach((height) => offsets.push(offsets[offsets.length - 1] + height));
    return offsets;
  }, [virtualRowHeights]);
  const totalVirtualHeight = virtualOffsets[virtualOffsets.length - 1] ?? 0;
  const visibleRange = useMemo(() => {
    if (!virtualRows.length) return { start: 0, end: 0 };
    const overscan = 6;
    let start = 0;
    while (start < virtualRows.length && virtualOffsets[start + 1] < scrollTop) start += 1;
    let end = start;
    const visibleBottom = scrollTop + viewportHeight;
    while (end < virtualRows.length && virtualOffsets[end] <= visibleBottom) end += 1;
    return { start: Math.max(0, start - overscan), end: Math.min(virtualRows.length, end + overscan) };
  }, [scrollTop, viewportHeight, virtualOffsets, virtualRows.length]);
  const visibleRows = virtualRows.slice(visibleRange.start, visibleRange.end);
  const topSpacerHeight = virtualOffsets[visibleRange.start] ?? 0;
  const bottomSpacerHeight = Math.max(0, totalVirtualHeight - (virtualOffsets[visibleRange.end] ?? totalVirtualHeight));

  useEffect(() => {
    const element = virtualListRef.current;
    if (!element) return;
    const updateViewportHeight = () => setViewportHeight(element.clientHeight || 640);
    updateViewportHeight();
    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (virtualListRef.current) virtualListRef.current.scrollTop = 0;
  }, [effectiveMonthFilter, effectiveStateFilter, layerFilter, targetFilter, workerFilter, workTypeFilter]);

  const renderTaskRow = (task: HistoricalTaskTimelineItemPayload) => {
    const taskKey = taskRowKey(task);
    const isExpanded = expandedTasks.has(taskKey);
    return (
      <article className={`task-row task-${task.task_state}`} key={taskKey} role="listitem">
        <div className="task-index">{task.task_number ?? task.sequence}</div>
        <div className="task-main">
          <div className="task-title-row">
            <strong>{task.task_label}</strong>
            <div className="task-title-badges">
              <span className="task-worker-chip">Worker: {workerLabel(task)}</span>
              <StatusPill status={taskStateLabel(task)} severity={taskStateSeverity(task.task_state)} />
            </div>
          </div>
          <div className="task-meta">
            <span>{monthLabel(task.month)}</span>
            <span>{layerLabel(task)}</span>
            {taskTargetMetaLabel(task) ? <span>{taskTargetMetaLabel(task)}</span> : null}
            <span>{startCase(task.stage_type)}</span>
            <span>{workerLabel(task)}</span>
            <span>{startCase(task.status)}</span>
            {task.status_updated_at_utc || task.updated_at_utc ? <span>Status updated {formatTimestamp((task.status_updated_at_utc ?? task.updated_at_utc) || undefined)}</span> : null}
          </div>
          {task.reason ? <div className="task-reason">{task.reason}</div> : null}
          {isExpanded ? <TaskDetailPanel task={task} /> : null}
        </div>
        <div className="task-counts">
          <span>{task.receipt_count ?? 0} receipts</span>
          <span>{task.blocker_count ?? 0} blockers</span>
          <button
            className="detail-toggle"
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setExpandedTasks((current) => {
              const next = new Set(current);
              if (next.has(taskKey)) next.delete(taskKey);
              else next.add(taskKey);
              return next;
            })}
          >
            {isExpanded ? 'Hide details' : 'Details'}
          </button>
        </div>
      </article>
    );
  };

  if (!tasks.length) {
    return (
      <section className="panel">
        <div className="panel-heading">Task List</div>
        <div className="empty-chart compact">No task timeline attached to this summary yet.</div>
      </section>
    );
  }
  return (
    <section className="panel task-list-panel">
      <div className="task-list-header">
        <div>
          <div className="panel-heading">Task List</div>
          <div className="task-filter-summary">Showing {filteredTasks.length} of {tasks.length} child tasks</div>
        </div>
        <button className="secondary-button" type="button" onClick={() => { setMonthFilter('auto'); setLayerFilter('all'); setStateFilter('auto'); setWorkTypeFilter('all'); setWorkerFilter('all'); setTargetFilter('all'); setExpandedTasks(new Set()); }}>
          Reset filters
        </button>
      </div>
      <div className="task-filters" aria-label="Task list filters">
        <SearchableFilter
          label="Month"
          listId="task-month-options"
          value={monthFilter}
          options={[["auto", "Now/latest period"], ["all", "All months"], ...monthOptions]}
          onChange={setMonthFilter}
        />
        <SearchableFilter
          label="Target"
          listId="task-target-options"
          value={targetFilter}
          options={[["all", "All targets"], ...targetOptions]}
          onChange={setTargetFilter}
        />
        <label>
          <span>Layer</span>
          <select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)}>
            <option value="all">All layers</option>
            {layerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Task</span>
          <select value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}>
            <option value="all">All tasks</option>
            {workTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="auto">Now if available</option>
            <option value="all">All statuses</option>
            {stateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Worker</span>
          <select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}>
            <option value="all">All workers</option>
            {workerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {virtualRows.length ? (
        <div
          className="virtual-task-list"
          ref={virtualListRef}
          role="list"
          aria-label="Virtualized task timeline"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: topSpacerHeight }} aria-hidden="true" />
          <div className="task-virtual-window">
            {visibleRows.map((row) => (
              row.kind === 'month' ? (
                <div className="task-month-heading" key={row.key}>
                  <strong>{row.month}</strong>
                  <span>{row.count} child tasks</span>
                </div>
              ) : renderTaskRow(row.task)
            ))}
          </div>
          <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
        </div>
      ) : (
        <div className="empty-chart compact">No tasks match the selected filters.</div>
      )}
    </section>
  );
}


function dataCellText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function DataExplorerView() {
  const [catalog, setCatalog] = useState<DataTableSpec[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [result, setResult] = useState<DataTableQueryResult | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchDataTableCatalog(controller.signal)
      .then((tables) => {
        setCatalog(tables);
        setSelectedTable((current) => current || tables[0]?.table_id || '');
        setError(null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load data table catalog.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    const controller = new AbortController();
    setLoading(true);
    fetchDataTableRows({
      table: selectedTable,
      search,
      filters,
      sort,
      direction,
      limit,
      offset,
      signal: controller.signal,
    })
      .then((payload) => {
        setResult(payload);
        if (!sort) {
          setSort(payload.sort);
          setDirection(payload.direction);
        }
        setError(null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load data table rows.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [direction, filters, offset, search, selectedTable, sort]);

  const selectedSpec = catalog.find((table) => table.table_id === selectedTable);
  const pageStart = result ? Math.min(result.total, result.offset + 1) : 0;
  const pageEnd = result ? Math.min(result.total, result.offset + result.rows.length) : 0;
  const canPageBack = (result?.offset ?? 0) > 0;
  const canPageForward = result ? result.offset + result.limit < result.total : false;

  const updateFilter = (column: string, value: string) => {
    setOffset(0);
    setFilters((current) => ({ ...current, [column]: value }));
  };

  const chooseSort = (column: string) => {
    setOffset(0);
    setSort((current) => {
      if (current === column) {
        setDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc');
        return current;
      }
      setDirection('asc');
      return column;
    });
  };

  const resetControls = () => {
    setSearchDraft('');
    setSearch('');
    setFilters({});
    setOffset(0);
  };

  return (
    <section className="panel data-explorer-panel">
      <div className="task-list-header">
        <div>
          <div className="panel-heading">Data Tables</div>
          <p className="panel-subtitle">Read-only data and model-output viewer. Select source, feature, or model output tables, then search, filter, sort, and page through rows.</p>
        </div>
        <button className="secondary-button" type="button" onClick={resetControls}>Reset filters</button>
      </div>
      <div className="data-toolbar">
        <label>
          <span>Data table</span>
          <select value={selectedTable} onChange={(event) => { setSelectedTable(event.target.value); setResult(null); setFilters({}); setSort(''); setDirection('asc'); setOffset(0); }}>
            {catalog.map((table) => <option key={table.table_id} value={table.table_id}>{table.label}</option>)}
          </select>
        </label>
        <form className="data-search-form" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(searchDraft.trim()); }}>
          <label>
            <span>Search all visible columns</span>
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search table…" />
          </label>
          <button className="primary-action compact-action" type="submit">Search</button>
        </form>
      </div>
      {selectedSpec ? <p className="dashboard-data-note">{selectedSpec.schema}.{selectedSpec.table} · {selectedSpec.description}</p> : null}
      {error ? <div className="execution-reason">{error}</div> : null}
      <div className="data-table-meta">
        <span>{loading ? 'Loading…' : result ? `Showing ${pageStart}-${pageEnd} of ${result.total}` : 'No table loaded'}</span>
        {result ? <span>Sorted by {result.sort} {result.direction.toUpperCase()}</span> : null}
      </div>
      {result ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th key={column.name}>
                    <button className="data-sort-button" type="button" onClick={() => chooseSort(column.name)}>
                      <span className="data-column-heading">
                        <span className="data-column-label">{column.label ?? column.name}</span>
                        <small>{column.name === (column.label ?? column.name) ? column.data_type : column.name}</small>
                      </span>
                      <span className="data-sort-indicator" aria-hidden="true">{sort === column.name ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                    <input
                      aria-label={`Filter ${column.name}`}
                      value={filters[column.name] ?? ''}
                      onChange={(event) => updateFilter(column.name, event.target.value)}
                      placeholder="Filter…"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.length ? result.rows.map((row, rowIndex) => (
                <tr key={`${result.offset}-${rowIndex}`}>
                  {result.columns.map((column) => <td key={column.name}>{dataCellText(row[column.name])}</td>)}
                </tr>
              )) : (
                <tr><td colSpan={result.columns.length || 1}>No rows match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-chart compact">Select a data table to load rows.</div>}
      <div className="data-pagination">
        <button className="secondary-button" type="button" disabled={!canPageBack} onClick={() => setOffset((current) => Math.max(0, current - limit))}>Previous</button>
        <span>Page size {limit}</span>
        <button className="secondary-button" type="button" disabled={!canPageForward} onClick={() => setOffset((current) => current + limit)}>Next</button>
      </div>
    </section>
  );
}

function DiagnosticsSummaryView({
  items,
  currentStatusModel: _currentStatusModel,
  historicalModel: _historicalModel,
}: {
  items: DiagnosticSummaryItem[];
  currentStatusModel: DashboardReadModel | null;
  historicalModel: DashboardReadModel | null;
}) {
  const [severityFilter, setSeverityFilter] = useState<DiagnosticSeverity | 'all'>('all');
  const severityCounts = {
    critical: items.filter((item) => item.severity === 'critical').length,
    error: items.filter((item) => item.severity === 'error').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    notice: items.filter((item) => item.severity === 'notice').length,
  };
  const filteredItems = severityFilter === 'all' ? items : items.filter((item) => item.severity === severityFilter);
  const severityCards: Array<{ key: DiagnosticSeverity | 'all'; label: string; value: number; hint: string }> = [
    { key: 'all', label: 'All', value: items.length, hint: 'All visible diagnostic rows' },
    { key: 'critical', label: 'Critical', value: severityCounts.critical, hint: 'Service/data failures needing immediate action' },
    { key: 'error', label: 'Errors', value: severityCounts.error, hint: 'Failed workflow or unhealthy runtime items' },
    { key: 'warning', label: 'Warnings', value: severityCounts.warning, hint: 'Needs review but not immediately fatal' },
    { key: 'notice', label: 'Notices', value: severityCounts.notice, hint: 'Informational or no-action-needed items' },
  ];
  return (
    <>
      <section className="diagnostic-filter-cards" aria-label="Diagnostics severity filters">
        {severityCards.map((card) => (
          <button
            className={`diagnostic-filter-card ${severityFilter === card.key ? 'active' : ''}`}
            key={card.key}
            onClick={() => setSeverityFilter(card.key)}
            type="button"
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </section>
      <section className="panel diagnostics-summary-panel">
        <div className="panel-heading">Error Summary</div>
        <p className="panel-subtitle">This page summarizes visible errors and status only. Use the agent conversation for diagnosis, repair, reruns, or external actions.</p>
        {filteredItems.length ? (
          <div className="diagnostic-table" role="table" aria-label="Diagnostics error summary">
            <div className="diagnostic-table-row diagnostic-table-head" role="row">
              <span>Ref</span>
              <span>Severity</span>
              <span>Error / status</span>
              <span>Occurred</span>
              <span>Handling</span>
            </div>
            {filteredItems.map((item) => {
              const errorNumber = diagnosticReference(item);
              return (
              <div className={`diagnostic-table-row diagnostic-${item.severity}`} key={item.id} role="row">
                <code>{errorNumber}</code>
                <span>{diagnosticSeverityLabel(item.severity)}</span>
                <div className="diagnostic-table-main">
                  <strong>{item.title}</strong>
                  <small>{item.category} · {item.status} · {item.detail}</small>
                </div>
                <span>{item.occurredAt ? formatTimestamp(item.occurredAt) : 'Not recorded'}</span>
                <span>{handlingStatusLabel(item.handlingStatus)}</span>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-chart compact">No diagnostics match the selected severity filter.</div>
        )}
      </section>
    </>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return (
    <section className="panel placeholder-view">
      <div className="panel-heading">{title}</div>
      <h2>Coming Soon</h2>
    </section>
  );
}

function contractForView(view: ViewId): string {
  if (view === 'status' || view === 'data') return CURRENT_SYSTEM_STATUS;
  if (view === 'realtime') return REALTIME_SIGNAL_SUMMARY;
  return HISTORICAL_TASK_PROGRESS;
}

function App() {
  const [currentStatusModel, setCurrentStatusModel] = useState<DashboardReadModel | null>(null);
  const [historicalModel, setHistoricalModel] = useState<DashboardReadModel | null>(null);
  const [realtimeModel, setRealtimeModel] = useState<DashboardReadModel | null>(null);
  const [readModelErrors, setReadModelErrors] = useState<Record<string, string>>({});
  const [loadingContracts, setLoadingContracts] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<ViewId>('status');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<ReadModelStreamStatus>('connecting');

  const applyReadModel = useCallback((payload: DashboardReadModel) => {
    if (payload.contract_type === CURRENT_SYSTEM_STATUS) setCurrentStatusModel(payload);
    if (payload.contract_type === HISTORICAL_TASK_PROGRESS) setHistoricalModel(payload);
    if (payload.contract_type === REALTIME_SIGNAL_SUMMARY) setRealtimeModel(payload);
    setReadModelErrors((previous) => {
      const next = { ...previous };
      delete next[payload.contract_type];
      return next;
    });
    setLastRefresh(new Date().toISOString());
  }, []);

  const loadReadModel = useCallback((contractType: string, signal?: AbortSignal) => {
    setLoadingContracts((previous) => new Set(previous).add(contractType));
    return fetchLatestReadModel(contractType, signal)
      .then(applyReadModel)
      .catch((problem: Error) => {
        if (problem.name === 'AbortError' || signal?.aborted) return;
        setReadModelErrors((previous) => ({ ...previous, [contractType]: problem.message }));
      })
      .finally(() => {
        if (!signal?.aborted) {
          setLoadingContracts((previous) => {
            const next = new Set(previous);
            next.delete(contractType);
            return next;
          });
        }
      });
  }, [applyReadModel]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReadModel(CURRENT_SYSTEM_STATUS, controller.signal);
    void loadReadModel(HISTORICAL_TASK_PROGRESS, controller.signal);
    void loadReadModel(REALTIME_SIGNAL_SUMMARY, controller.signal);
    const liveContracts = new Set<string>();
    const contracts = [CURRENT_SYSTEM_STATUS, HISTORICAL_TASK_PROGRESS, REALTIME_SIGNAL_SUMMARY];
    const sockets = contracts.map((contractType) => openLatestReadModelSocket(contractType, {
      onSnapshot: (payload) => {
        liveContracts.add(contractType);
        applyReadModel(payload);
        setLoadingContracts((previous) => {
          const next = new Set(previous);
          next.delete(contractType);
          return next;
        });
      },
      onStatus: setStreamStatus,
      onError: (message) => {
        if (!liveContracts.has(contractType)) {
          setReadModelErrors((previous) => ({ ...previous, [contractType]: message }));
        }
      },
    }));
    const fallbackIntervalId = window.setInterval(() => {
      sockets.forEach((socket, index) => {
        if (socket.readyState !== WebSocket.OPEN) void loadReadModel(contracts[index]);
      });
    }, 60_000);
    return () => {
      controller.abort();
      sockets.forEach((socket) => socket.close());
      window.clearInterval(fallbackIntervalId);
    };
  }, [applyReadModel, loadReadModel]);

  const activeContractType = contractForView(activeView);
  const activeReadModel = activeView === 'status' || activeView === 'data'
    ? currentStatusModel
    : activeView === 'realtime'
      ? realtimeModel
      : historicalModel;
  const pageStatusModel = currentStatusModel ?? activeReadModel;
  const activeError = readModelErrors[activeContractType] ?? null;
  const loading = loadingContracts.size > 0;
  const chart = useMemo(() => {
    if (!historicalModel || !isHistoricalChart(historicalModel.chart_payload)) return {} as HistoricalTaskProgressChartPayload;
    return historicalModel.chart_payload;
  }, [historicalModel]);
  const systemChart = useMemo(() => {
    if (!currentStatusModel || typeof currentStatusModel.chart_payload !== 'object' || Array.isArray(currentStatusModel.chart_payload)) return {} as CurrentSystemStatusChartPayload;
    return currentStatusModel.chart_payload as CurrentSystemStatusChartPayload;
  }, [currentStatusModel]);
  const realtimeChart = useMemo(() => {
    if (!realtimeModel || !isRealtimeSignalChart(realtimeModel.chart_payload)) return {} as RealtimeSignalChartPayload;
    return realtimeModel.chart_payload;
  }, [realtimeModel]);
  const diagnosticItems = useMemo(
    () => collectDiagnosticSummary(currentStatusModel, historicalModel, systemChart, chart),
    [chart, currentStatusModel, historicalModel, systemChart],
  );

  const renderServerResourcesPanel = () => {
    const server = systemChart.server ?? {};
    return (
      <section className="panel resource-panel">
        <div className="panel-heading">Server Resources</div>
        <div className="resource-grid server-resource-grid">
          <MetricCard label="CPU" value={formatPercent(server.cpu_usage_percent)} />
          <MetricCard label="Memory" value={formatPercent(server.memory_usage_percent)} hint={`${server.memory_available_mb ?? 0} MB available`} />
          <MetricCard label="Available Storage" value={`${server.storage_available_gb ?? 0} GB`} hint={`Total capacity ${server.storage_total_gb ?? 0} GB`} />
          <MetricCard label="Download" value={formatNetworkRate(server.network_download_kbps)} />
          <MetricCard label="Upload" value={formatNetworkRate(server.network_upload_kbps)} />
          <MetricCard label="Uptime" value={`${Math.round((server.uptime_seconds ?? 0) / 3600)}h`} />
        </div>
      </section>
    );
  };

  const renderThreadingPanel = () => {
    const runtime = systemChart.runtime_throughput ?? {};
    const monthWorkers = runtime.month_ingest_worker_count ?? 0;
    const modelWorkers = runtime.model_worker_count ?? 0;
    const rounds = runtime.month_ingest_rounds_per_fold;
    return (
      <section className="panel runtime-throughput-panel">
        <div className="panel-heading">Runtime Throughput</div>
        <p className="panel-subtitle">{runtime.summary ?? 'Historical scheduler throughput has not been observed yet.'}</p>
        <div className="artifact-grid runtime-throughput-grid">
          <MetricCard label="Runtime lanes" value={`${monthWorkers}+${modelWorkers}`} hint={`${runtime.total_worker_count ?? monthWorkers + modelWorkers} total workers`} />
          <MetricCard label="Fold cadence" value={`${runtime.fold_month_count ?? 6} months`} hint={rounds ? `${rounds} ingest rounds per fold` : 'non-overlapping folds'} />
          <MetricCard label="Completion rate" value={`${runtime.completion_rate_per_minute ?? 0}/min`} hint={`${runtime.executed_decision_count ?? 0} completed decisions`} />
          <MetricCard label="Peak completions" value={`${runtime.max_completions_per_second ?? 0}/sec`} hint={`${runtime.multi_completion_second_count ?? 0} seconds had multiple completions`} />
          <MetricCard label="Observation window" value={`${runtime.window_minutes ?? 15}m`} hint={runtime.latest_decision_at_utc ? `latest scheduler decision ${formatTimestamp(runtime.latest_decision_at_utc)}` : 'no decision timestamp'} />
          <MetricCard label="Idle/blocked decisions" value={runtime.idle_or_blocked_decision_count ?? 0} hint={`${runtime.decision_count ?? 0} scheduler decisions observed`} />
        </div>
      </section>
    );
  };

  const renderCurrentStatusView = () => {
    const services = systemChart.services ?? [];
    const sourceOutputs = [...(systemChart.source_outputs ?? [])].sort((left, right) =>
      compareDisplayRank(left, right, dashboardDataDisplayRank, (output) => output.label),
    );
    const sourceConnections = systemChart.source_connections ?? systemChart.apis ?? [];
    const sourceConnectionUnits = new Set(
      sourceConnections.flatMap((connection) => [connection.unit, connection.service_unit, connection.timer_unit]).filter((unit): unit is string => Boolean(unit)),
    );
    const backgroundServices = services
      .filter((service) => !sourceConnectionUnits.has(service.unit))
      .sort((left, right) => compareDisplayRank(left, right, serviceDisplayRank, (service) => publicServiceLabel(service.unit)));
    return (
      <>
        {renderServerResourcesPanel()}
        {renderThreadingPanel()}
        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">Source Connections</div>
            <div className="service-list">
              {sourceConnections.map((api) => {
                const healthy = api.healthy ?? apiIsHealthy(api.status);
                return (
                  <div className="service-row" key={`${api.kind ?? 'api'}-${api.name}`}>
                    <span>{api.name}</span>
                    <strong className={healthy ? 'service-ok' : 'service-warn'}>{apiStatusLabel(api.status)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">Background Services</div>
            <div className="service-list">
              {backgroundServices.map((service) => (
                <div className="service-row" key={service.unit}>
                  <span>{publicServiceLabel(service.unit)}</span>
                  <strong className={serviceIsHealthyForDisplay(service) ? 'service-ok' : 'service-warn'}>
                    {serviceStatusLabel(service)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </section>
        <section className="panel">
          <div className="panel-heading">Dashboard Data</div>
          <p className="dashboard-data-note">These are source artifact write times, not the dashboard refresh time. Heartbeat rows should stay fresh; event-driven rows change only when the scheduler records a decision or stage progress.</p>
          <div className="dashboard-file-list">
            {sourceOutputs.map((output) => (
              <div className="dashboard-file-row" key={`${output.kind ?? 'source'}-${output.label}`}>
                <div className="dashboard-file-main">
                  <span>{output.label}</span>
                  <small>{sourceOutputFreshnessLabel(output.freshness_class)} · {output.freshness_note ?? 'Freshness behavior not described.'}</small>
                </div>
                <strong className={output.status === 'available' ? 'service-ok' : 'service-warn'}>{sourceOutputStatus(output)}</strong>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  const renderRealtimeSignalsView = () => {
    if (!realtimeModel) {
      return <section className="panel loading-panel">Loading realtime signal summary…</section>;
    }
    const monitor = realtimeChart.monitor ?? {};
    const safety = realtimeChart.safety ?? {};
    const readiness = realtimeChart.readiness ?? {};
    const signalCards = realtimeChart.signal_cards ?? [];
    return (
      <>
        <section className="metric-grid">
          <MetricCard label="Mode" value={startCase(realtimeChart.mode)} />
          <MetricCard label="Monitor" value={startCase(monitor.status)} hint={monitor.latest_updated_at_utc ? 'latest ' + formatTimestamp(monitor.latest_updated_at_utc) : 'No monitor receipt yet'} />
          <MetricCard label="Cycles" value={monitor.cycle_count ?? 0} hint={(monitor.failed_cycle_count ?? 0) + ' failed cycles'} />
          <MetricCard label="Provider observations" value={safety.provider_calls_performed ?? 0} hint="Read-only observations only" />
        </section>
        <section className="panel">
          <div className="panel-heading">Signal Readiness</div>
          <p className="panel-subtitle">{realtimeModel.summary}</p>
          <div className="signal-card-grid">
            {signalCards.map((card) => (
              <section className="signal-card" key={String(card.label) + '-' + String(card.status)}>
                <div className="signal-card-head">
                  <span>{card.label}</span>
                  <StatusPill status={card.status ?? 'unknown'} severity={signalStatusSeverity(card.status)} />
                </div>
                <strong>{displayValue(card.value)}</strong>
                {card.hint ? <small>{card.hint}</small> : null}
              </section>
            ))}
          </div>
        </section>
        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">Handoff Readiness</div>
            <div className="service-list">
              <div className="service-row">
                <span>Realtime feature snapshot</span>
                <strong className={signalStatusSeverity(readiness.feature_snapshot_readiness) === 'low' ? 'service-ok' : 'service-warn'}>{startCase(readiness.feature_snapshot_readiness)}</strong>
              </div>
              <div className="service-row">
                <span>Model decision input</span>
                <strong className={signalStatusSeverity(readiness.decision_input_readiness) === 'low' ? 'service-ok' : 'service-warn'}>{startCase(readiness.decision_input_readiness)}</strong>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">Safety Boundary</div>
            <div className="service-list">
              <div className="service-row"><span>Broker calls</span><strong className={(safety.broker_calls_performed ?? 0) === 0 ? 'service-ok' : 'service-warn'}>{safety.broker_calls_performed ?? 0}</strong></div>
              <div className="service-row"><span>Model activation</span><strong className={!safety.model_activation_performed ? 'service-ok' : 'service-warn'}>{safety.model_activation_performed ? 'Performed' : 'Disabled'}</strong></div>
              <div className="service-row"><span>Order construction</span><strong className={!safety.broker_order_construction_performed ? 'service-ok' : 'service-warn'}>{safety.broker_order_construction_performed ? 'Performed' : 'Disabled'}</strong></div>
              <div className="service-row"><span>Account mutation</span><strong className={!safety.account_mutation_performed ? 'service-ok' : 'service-warn'}>{safety.account_mutation_performed ? 'Performed' : 'Disabled'}</strong></div>
            </div>
          </section>
        </section>
        {realtimeChart.gaps?.length ? (
          <section className="panel">
            <div className="panel-heading">Visible Gaps</div>
            <div className="chips">{realtimeChart.gaps.map((gap) => <span className="chip" key={gap}>{startCase(gap)}</span>)}</div>
          </section>
        ) : null}
      </>
    );
  };

  const renderMainView = () => {
    if (activeView === 'status') return renderCurrentStatusView();
    if (activeView === 'data') return <DataExplorerView />;
    if (!historicalModel) return null;
    if (activeView === 'diagnostics') {
      return <DiagnosticsSummaryView items={diagnosticItems} currentStatusModel={currentStatusModel} historicalModel={historicalModel} />;
    }
    if (activeView === 'tasks') {
      return <TaskTimelineList tasks={chart.task_timeline ?? []} />;
    }
    if (activeView === 'models') {
      const stageTotal = sumStageCounts(chart.stage_counts);
      const terminalStages = terminalStageCount(chart.stage_counts);
      return (
        <>
          <section className="metric-grid">
            <MetricCard label="Current month" value={chart.current_month ?? 'Unknown'} />
            <MetricCard label="Active stage" value={startCase(chart.active_stage)} />
            <MetricCard label="Workflow" value={startCase(historicalModel.status)} hint={chart.terminal_complete ? 'Terminal complete' : `Lock ${startCase(chart.lock_status)}`} />
            <MetricCard label="Progress" value={formatPercent(chart.progress_percent)} hint={`${terminalStages}/${stageTotal || 0} terminal stages`} />
          </section>
          <HistoricalProgressVisual chart={chart} />
          <section className="detail-grid">
            <section className="panel">
              <div className="panel-heading">System Gates</div>
              <div className="service-list">
                <div className="service-row">
                  <span>Service Runtime</span>
                  <strong className={chart.service_runtime_ready ? 'service-ok' : 'service-warn'}>{workflowGateLabel(chart.service_runtime_ready)}</strong>
                </div>
                <div className="service-row">
                  <span>Scheduler Lock</span>
                  <strong className={chart.lock_status === 'active' ? 'service-ok' : 'service-warn'}>{startCase(chart.lock_status)}</strong>
                </div>
                <div className="service-row">
                  <span>Provider Stage Posture</span>
                  <strong className={providerPostureIsOk(chart.provider_status) ? 'service-ok' : 'service-warn'}>{startCase(chart.provider_status)}</strong>
                </div>
                <div className="service-row">
                  <span>Terminal Complete</span>
                  <strong className={chart.terminal_complete ? 'service-ok' : 'service-warn'}>{chart.terminal_complete ? 'Yes' : 'No'}</strong>
                </div>
              </div>
            </section>
          </section>
        </>
      );
    }
    if (activeView === 'registry') return <PlaceholderView title="Definitions" />;
    if (activeView === 'realtime') return renderRealtimeSignalsView();
    if (activeView === 'performance') return <PlaceholderView title="Trading Performance" />;
    return (
      <>
        <section className="metric-grid">
          <MetricCard label="Month" value={chart.current_month ?? 'Unknown'} />
          <MetricCard label="Active stage" value={startCase(chart.active_stage)} />
          <MetricCard label="Provider posture" value={startCase(chart.provider_status)} />
          <MetricCard label="Lock" value={startCase(chart.lock_status)} />
        </section>
        <HistoricalProgressVisual chart={chart} />
        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">Diagnostic Refs</div>
            <div className="chips">
              {historicalModel.diagnostic_refs.length ? historicalModel.diagnostic_refs.map((ref, index) => (
                <span className="chip" key={index}>{safeRefLabel(ref, `diagnostic_${index + 1}`)}</span>
              )) : <span className="muted">None</span>}
            </div>
          </section>
        </section>
      </>
    );
  };

  const pageTitle = activeView === 'status' ? 'Current Status' : activeView === 'data' ? 'Data' : startCase(activeView);
  const pageEyebrow = activeView === 'status' ? 'System / Status' : activeView === 'data' ? 'Data + Model Outputs / Dashboard' : `${startCase(activeView)} / Dashboard`;

  const refreshAll = () => {
    void loadReadModel(CURRENT_SYSTEM_STATUS);
    void loadReadModel(HISTORICAL_TASK_PROGRESS);
    void loadReadModel(REALTIME_SIGNAL_SUMMARY);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><img src="/trading-dashboard-icon.png?v=20260513b" alt="" aria-hidden="true" /></div>
          <div>
            <div className="brand-title">Trading Dashboard</div>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary dashboard navigation">
          {navItems.map((item) => (
            <button className={`nav-item ${activeView === item.id ? 'active' : ''}`} key={item.id} type="button" onClick={() => setActiveView(item.id)}>
              <span>{item.label}</span>
              <small>{item.state}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <section className="top-status-bar" aria-label="Dashboard status bar">
          <div className="top-status-primary">
            {pageStatusModel ? <StatusPill status={pageStatusModel.status} severity={pageStatusModel.severity || 'info'} /> : null}
          </div>
          <div className="top-status-meta">
            <span>Last refreshed {lastRefresh ? formatTimestamp(lastRefresh) : 'Unknown'}</span>
            <button className="primary-action compact-action" type="button" onClick={refreshAll} disabled={loadingContracts.size > 0}>
              {loadingContracts.size > 0 ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </section>

        <header className="hero">
          <div>
            <div className="eyebrow">{pageEyebrow}</div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {loading && !activeReadModel ? <section className="panel loading-panel">Loading latest dashboard status…</section> : null}

        {activeError ? (
          <section className="panel error-panel">
            <div className="panel-heading">Dashboard data unavailable</div>
            <p>{activeError}</p>
          </section>
        ) : null}

        {activeReadModel ? (
          <>
            {renderMainView()}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
