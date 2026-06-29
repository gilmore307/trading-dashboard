import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
} from 'lightweight-charts';
import { HistoricalProgressVisual, MetricCard, ProgressBar, StatusPill } from './components';
import { fetchDataTableCatalog, fetchDataTableRows, type DataTableQueryResult, type DataTableSpec } from './dataTables';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel, openLatestReadModelSocket, type ReadModelStreamStatus } from './readModels';
import type {
  AgentErrorSummaryPayload,
  CurrentSystemSourceOutputPayload,
  CurrentSystemServicePayload,
  CurrentSystemStatusChartPayload,
  DashboardReadModel,
  ExecutionRuntimeStatusChartPayload,
  HistoricalTaskProgressChartPayload,
  HistoricalRuntimeActivityPayload,
  HistoricalTaskTimelineItemPayload,
  ModelLayerReadinessChartPayload,
  ModelVersionSummaryPayload,
  ModelGroupPromotionVersionPayload,
  ModelPromotionItemPayload,
  ModelPromotionPostureChartPayload,
  RealtimeSignalChartPayload,
  TemporalExplorerChartBarPayload,
  TemporalExplorerChartPayload,
  TemporalExplorerEventPayload,
  TemporalExplorerTickPayload,
} from './types';
import './styles.css';

const CURRENT_SYSTEM_STATUS = 'current_system_status_summary';
const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary';
const REALTIME_SIGNAL_SUMMARY = 'realtime_signal_summary';
const TEMPORAL_EXPLORER_SUMMARY = 'temporal_explorer_summary';
const MODEL_READINESS = 'model_readiness_summary';
const MODEL_PROMOTION_POSTURE = 'model_promotion_posture_summary';
const MODEL_GROUP_REPLAY_REVIEW = 'model_group_replay_review_summary';
const EXECUTION_RUNTIME_STATUS = 'execution_realtime_trading_runtime_status';

const SOURCE_LABELS: Record<string, string> = {
  'trading-storage': 'System Monitor',
  'trading-manager': 'Task Manager',
};

const SERVICE_LABELS: Record<string, string> = {
  'trading-dashboard-web.service': 'Dashboard Web UI',
  'trading-manager-historical-scheduler.service': 'Historical Training Automation',
  'trading-execution-realtime-monitor-loop.service': 'Realtime Monitor Loop',
  'trading-execution-realtime-runtime-check.service': 'Realtime Runtime Check Worker',
  'trading-execution-realtime-runtime-check.timer': 'Realtime Runtime Check Schedule',
  'trading-execution-realtime-runtime-check.path': 'Realtime Runtime Check Watcher',
  'trading-storage-dashboard-read-model-refresh.timer': 'Dashboard Refresh Schedule',
  'trading-storage-dashboard-read-model-refresh.service': 'Dashboard Refresh Worker',
  'trading-data-te-calendar-refresh.timer': 'Trading Economics Calendar Schedule',
  'trading-data-te-calendar-refresh.service': 'Trading Economics Calendar Worker',
  'trading-data-calendar-maintenance.timer': 'Trading Data Calendar Maintenance Schedule',
  'trading-data-calendar-maintenance.service': 'Trading Data Calendar Maintenance Worker',
  'trading-data-te-release-fetch.timer': 'Trading Economics Release Fetch Schedule',
  'trading-data-te-release-fetch.service': 'Trading Economics Release Fetcher',
};

const BACKGROUND_SERVICE_DISPLAY_ORDER: Record<string, number> = {
  'trading-dashboard-web.service': 10,
  'trading-storage-dashboard-read-model-refresh.timer': 20,
  'trading-storage-dashboard-read-model-refresh.service': 30,
  'trading-manager-historical-scheduler.service': 40,
  'trading-data-te-calendar-refresh.timer': 50,
  'trading-data-te-calendar-refresh.service': 60,
  'trading-data-calendar-maintenance.timer': 70,
  'trading-data-calendar-maintenance.service': 80,
  'trading-data-te-release-fetch.timer': 90,
  'trading-data-te-release-fetch.service': 100,
  'trading-execution-realtime-monitor-loop.service': 110,
  'trading-execution-realtime-runtime-check.path': 120,
  'trading-execution-realtime-runtime-check.timer': 130,
  'trading-execution-realtime-runtime-check.service': 140,
};

const DASHBOARD_DATA_DISPLAY_ORDER: Record<string, number> = {
  storage_dashboard_current_status_latest: 10,
  storage_dashboard_historical_task_progress_latest: 20,
  storage_dashboard_temporal_explorer_latest: 30,
  storage_dashboard_realtime_signal_latest: 40,
  storage_dashboard_execution_runtime_latest: 50,
  storage_dashboard_read_model_index: 60,
  manager_scheduler_state: 100,
  manager_scheduler_decision_log: 110,
  manager_workflow_state: 120,
  manager_stage_coverage: 130,
  manager_stage_run_dashboard: 140,
  execution_runtime_status: 200,
  execution_realtime_monitor_receipt: 210,
  execution_realtime_monitor_cycle: 220,
  trading_economics_calendar_source_receipt: 300,
  trading_economics_calendar_source_events: 310,
};

type ViewId = 'status' | 'tasks' | 'data' | 'diagnostics' | 'models' | 'replay' | 'registry' | 'realtime' | 'performance' | 'decisions' | 'events';

type NavItem = { id: ViewId; label: string };

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'General',
    items: [
      { id: 'status', label: 'Status' },
      { id: 'registry', label: 'Definitions' },
      { id: 'diagnostics', label: 'Diagnostics' },
    ],
  },
  {
    label: 'Historical Models',
    items: [
      { id: 'tasks', label: 'Tasks' },
      { id: 'data', label: 'Data' },
      { id: 'models', label: 'Models' },
      { id: 'performance', label: 'Replay Performance' },
      { id: 'decisions', label: 'Replay Decisions' },
      { id: 'replay', label: 'Replay Operations' },
      { id: 'events', label: 'Events' },
    ],
  },
  {
    label: 'Realtime',
    items: [
      { id: 'realtime', label: 'Realtime Signals' },
    ],
  },
];

function isHistoricalChart(payload: DashboardReadModel['chart_payload']): payload is HistoricalTaskProgressChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isRealtimeSignalChart(payload: DashboardReadModel['chart_payload']): payload is RealtimeSignalChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isTemporalExplorerChart(payload: DashboardReadModel['chart_payload']): payload is TemporalExplorerChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isModelLayerReadinessChart(payload: DashboardReadModel['chart_payload']): payload is ModelLayerReadinessChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isModelPromotionPostureChart(payload: DashboardReadModel['chart_payload']): payload is ModelPromotionPostureChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isExecutionRuntimeChart(payload: DashboardReadModel['chart_payload']): payload is ExecutionRuntimeStatusChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

type ReplayReviewChartPayload = {
  page_contracts?: Array<Record<string, unknown>>;
  review_runs?: Array<Record<string, unknown>>;
  event_runs?: Array<Record<string, unknown>>;
  contract_matrix?: Record<string, unknown>;
};

function isReplayReviewChart(payload: DashboardReadModel['chart_payload']): payload is ReplayReviewChartPayload {
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
  typeKey: string;
  typeLabel: string;
  status: string;
  detail: string;
  severity: DiagnosticSeverity;
  handlingStatus: DiagnosticHandlingStatus;
  agentInterventionStatus?: string | null;
  errorRef?: string | null;
  occurredAt?: string | null;
};

type DiagnosticStatusFilter = 'unresolved' | DiagnosticHandlingStatus | 'all';

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
  if (runner.includes('codex_cli') || runner.includes('run_agent_error_agent.py')) return 'Codex';
  if (runner.includes('openclaw_agent')) return 'Agent';
  if (runner.includes('safe_error_repair') || runner.includes('run_safe_error_repair.py')) return 'Safe repair';
  if (!runner.trim()) return 'Codex';
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
  if (repair === 'blocked') return reviewed ? `${runnerLabel} repair blocked` : 'Repair blocked';
  if (repair === 'failed') return reviewed ? `${runnerLabel} repair failed` : 'Repair failed';
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
  return item.errorRef || `${diagnosticGeneratedPrefix(item.category)}-${stableHashHex(item.id)}`;
}

function isUnresolvedDiagnostic(item: DiagnosticSummaryItem): boolean {
  return !['closed', 'no_action_required'].includes(item.handlingStatus);
}

function diagnosticTypeOptions(items: DiagnosticSummaryItem[]): Array<[string, string]> {
  const options = new Map<string, string>();
  items.forEach((item) => {
    options.set(item.typeKey, item.typeLabel);
  });
  return [['all', 'All types'], ...Array.from(options.entries()).sort((left, right) => left[1].localeCompare(right[1]))];
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
  if (task.task_state === 'current') return 'Active';
  if (task.task_state === 'completed') return 'Past';
  if (task.task_state === 'future') return 'Future';
  if (task.task_state === 'failed') return 'Failed';
  if (task.task_state === 'skipped') return 'Skipped';
  return startCase(task.task_state);
}

function taskFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  return task.task_id || task.task_label || task.stage_type || 'unknown';
}

function taskFilterLabel(task: HistoricalTaskTimelineItemPayload): string {
  return task.task_label || startCase(task.stage_type || task.task_id || 'unknown');
}

function taskTargetSymbol(task: HistoricalTaskTimelineItemPayload): string | null {
  return task.target_symbol || task.detail?.dataset_unit?.target_symbol || null;
}

function taskTargetFilterValue(task: HistoricalTaskTimelineItemPayload): string {
  const target = taskTargetSymbol(task);
  if (target) return target;
  return 'not_targeted';
}

function activeTaskLabel(chart: HistoricalTaskProgressChartPayload): string {
  const activeTask = chart.active_task;
  if (activeTask?.task_label) return activeTask.task_label;
  return startCase(chart.active_stage);
}

function runtimeWorkLabel(chart: HistoricalTaskProgressChartPayload): string {
  const runtimeWork = chart.runtime_active_work;
  const activity = runtimeWork?.runtime_activity;
  if (activity?.activity_label) return activity.activity_label;
  if (runtimeWork?.stage_id) return startCase(runtimeWork.stage_id);
  if (chart.internal_active_stage) return startCase(chart.internal_active_stage);
  return startCase(runtimeWork?.status || 'unknown');
}

function runtimeWorkHint(chart: HistoricalTaskProgressChartPayload): string {
  const runtimeWork = chart.runtime_active_work;
  const activity = runtimeWork?.runtime_activity;
  if (activity?.activity_summary) return activity.activity_summary;
  const status = startCase(runtimeWork?.status || chart.lock_status || 'unknown');
  const month = runtimeWork?.month || chart.internal_current_month || chart.current_month || 'unknown period';
  const reason = runtimeWork?.reason_code || runtimeWork?.decision_status || runtimeWork?.reason;
  return reason ? `${status} · ${month} · ${startCase(reason)}` : `${status} · ${month}`;
}

function runtimeActivitySummary(activity?: HistoricalRuntimeActivityPayload | null): string {
  if (!activity) return '';
  if (activity.activity_summary) return activity.activity_summary;
  const parts = [activity.activity_label || 'Live activity'];
  if (activity.replay_time_pointer) parts.push(activity.replay_time_pointer);
  if (activity.source_missing_count !== undefined && activity.source_missing_count !== null) {
    parts.push(`${activity.source_missing_count} source-gap candidates`);
  }
  return parts.join(' · ');
}

function runtimeActivityMetrics(activity?: HistoricalRuntimeActivityPayload | null): string[] {
  if (!activity) return [];
  const frontierRequirementCount = activity.requirement_count;
  const sourceGapCandidateCount = activity.source_missing_count;
  const batchCandidateCount =
    activity.batch_count !== undefined && activity.batch_count !== null && activity.batch_count !== sourceGapCandidateCount
      ? activity.batch_count
      : null;
  return [
    frontierRequirementCount !== undefined && frontierRequirementCount !== null ? `${frontierRequirementCount} total frontier requirements` : null,
    sourceGapCandidateCount !== undefined && sourceGapCandidateCount !== null ? `${sourceGapCandidateCount} source-gap candidates in current repair slice` : null,
    activity.provider_calls !== undefined && activity.provider_calls !== null && activity.provider_calls > 0 ? `${activity.provider_calls} provider calls this pass` : null,
    activity.option_source_unavailable_count !== undefined && activity.option_source_unavailable_count !== null && activity.option_source_unavailable_count > 0
      ? `${activity.option_source_unavailable_count} provider-unavailable option sources`
      : null,
    activity.source_ready_count !== undefined && activity.source_ready_count !== null && activity.source_ready_count > 0
      ? `${activity.source_ready_count} source-ready repairs`
      : null,
    batchCandidateCount !== null && batchCandidateCount > 0 ? `${batchCandidateCount} repair candidates selected` : null,
    activity.batch_index !== undefined && activity.batch_index !== null && activity.batch_index > 0 ? `drain pass ${activity.batch_index}` : null,
  ].filter(Boolean) as string[];
}

function runtimeActivitySamples(activity?: HistoricalRuntimeActivityPayload | null): string {
  const targets = activity?.sample_targets?.filter(Boolean) ?? [];
  return targets.length ? `Example targets ${targets.slice(0, 6).join(', ')}` : '';
}

function runtimeActivityTraceLine(activity?: HistoricalRuntimeActivityPayload | null): string {
  const traceRef = activity?.replay_runtime_trace_ref;
  if (!traceRef) return '';
  const traceName = traceRef.split('/').filter(Boolean).pop() || traceRef;
  return `Trace ${traceName}`;
}

function taskRuntimeStatusLabel(task: HistoricalTaskTimelineItemPayload): string {
  const status = String(task.status || '').toLowerCase();
  if (status === 'running') return 'Running';
  if (status === 'blocked') return 'Waiting';
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Failed';
  return startCase(task.status || task.task_state || 'current');
}

function taskLivePeriod(task: HistoricalTaskTimelineItemPayload): string {
  const unit = task.detail?.dataset_unit;
  if (unit?.start_month && unit?.end_month) return `${unit.start_month} to ${unit.end_month}`;
  return monthLabel(task.month);
}

function taskLiveScope(task: HistoricalTaskTimelineItemPayload): string {
  const parts = [
    taskLivePeriod(task),
    taskTargetSymbol(task) ? `Target ${taskTargetSymbol(task)}` : null,
    task.worker_label || task.worker_id || null,
  ].filter(Boolean) as string[];
  return parts.join(' · ');
}

function taskProgressLine(task: HistoricalTaskTimelineItemPayload): string | null {
  const progress = taskProgressView(task);
  if (!progress.label && !progress.hint) return null;
  return progress.hint ? `${progress.label} · ${progress.hint}` : progress.label;
}

function taskExecutionLines(task: HistoricalTaskTimelineItemPayload): string[] {
  const execution = task.detail?.last_execution ?? null;
  return [
    execution?.reason ? `Latest execution ${startCase(execution.status)} · ${execution.reason}` : null,
    execution && execution.return_code !== undefined && execution.return_code !== null ? `Latest return code ${execution.return_code}` : null,
  ].filter(Boolean) as string[];
}

function taskBlockingLines(task: HistoricalTaskTimelineItemPayload): string[] {
  const blockers = task.detail?.blockers ?? [];
  return [
    task.reason || null,
    blockers.length ? `Waiting on ${blockers.slice(0, 3).map(startCase).join(', ')}${blockers.length > 3 ? ` +${blockers.length - 3}` : ''}` : null,
  ].filter(Boolean) as string[];
}

function taskLiveDetails(task: HistoricalTaskTimelineItemPayload, ...extraLines: Array<string | null | undefined>): string[] {
  const lines = [
    taskLiveScope(task),
    ...extraLines,
    taskProgressLine(task),
    ...taskBlockingLines(task),
    ...taskExecutionLines(task),
  ].filter(Boolean) as string[];
  return Array.from(new Set(lines));
}

function taskLiveActivityByKind(task: HistoricalTaskTimelineItemPayload): HistoricalRuntimeActivityPayload {
  const status = taskRuntimeStatusLabel(task);
  const stageType = String(task.stage_type || '');
  const taskId = String(task.task_id || '');
  const target = taskTargetSymbol(task);
  const base = {
    updated_at_utc: task.status_updated_at_utc ?? task.updated_at_utc ?? task.started_at_utc ?? null,
    progress_label: taskProgressView(task).label,
    progress_hint: taskProgressView(task).hint,
    sample_targets: target ? [target] : [],
  };

  if (taskId === 'model_group.replay') {
    return {
      ...base,
      activity_type: 'model_group_replay',
      activity_label: `Replay ${status}`,
      activity_summary: [`Replay ${status}`, taskLivePeriod(task), 'executing historical decisions'].join(' · '),
      activity_details: taskLiveDetails(task, 'Keeps monthly replay continuous across calendar boundaries.'),
    };
  }
  if (taskId === 'model_group.replay_review') {
    return {
      ...base,
      activity_type: 'model_group_replay_review',
      activity_label: `Replay Review ${status}`,
      activity_summary: [`Replay Review ${status}`, taskLivePeriod(task), 'auditing decision funnel'].join(' · '),
      activity_details: taskLiveDetails(task, 'Reviews selection, direction, stock path, option expression, execution, and settlement.'),
    };
  }
  if (taskId === 'model_group.model_06_event_risk_governor') {
    return {
      ...base,
      activity_type: 'event_risk_governor',
      activity_label: `Event Governor ${status}`,
      activity_summary: [`Event Governor ${status}`, taskLivePeriod(task), 'checking residual event risk'].join(' · '),
      activity_details: taskLiveDetails(task, 'Consumes post-replay review evidence before event-risk governance.'),
    };
  }
  if (taskId === 'model_group.evaluation' || stageType === 'model_evaluation') {
    return {
      ...base,
      activity_type: 'model_evaluation',
      activity_label: `Evaluation ${status}`,
      activity_summary: [`Evaluation ${status}`, taskLivePeriod(task), 'scoring benchmark and guardrails'].join(' · '),
      activity_details: taskLiveDetails(task, 'Checks replay metrics, guardrails, incumbent comparison, and uncertainty.'),
    };
  }
  if (taskId === 'model_group.promotion' || stageType === 'promotion_review') {
    return {
      ...base,
      activity_type: 'promotion_review',
      activity_label: `Promotion Review ${status}`,
      activity_summary: [`Promotion Review ${status}`, taskLivePeriod(task), 'deciding model lifecycle posture'].join(' · '),
      activity_details: taskLiveDetails(task, 'Checks fixed benchmark, blinded comparison, uncertainty, and shadow readiness.'),
    };
  }
  if (taskId === 'model_group.maintenance' || stageType === 'maintenance') {
    return {
      ...base,
      activity_type: 'maintenance',
      activity_label: `Maintenance ${status}`,
      activity_summary: [`Maintenance ${status}`, taskLivePeriod(task), 'reconciling readiness artifacts'].join(' · '),
      activity_details: taskLiveDetails(task, 'Publishes readiness, guardrail, and lifecycle-maintenance records.'),
    };
  }
  if (stageType === 'data_acquisition') {
    return {
      ...base,
      activity_type: 'data_acquisition',
      activity_label: `Data Acquisition ${status}`,
      activity_summary: [`Data Acquisition ${status}`, taskLivePeriod(task), task.task_label].join(' · '),
      activity_details: taskLiveDetails(task, 'Acquires or verifies point-in-time source coverage before feature work.'),
    };
  }
  if (stageType === 'feature_generation') {
    return {
      ...base,
      activity_type: 'feature_generation',
      activity_label: `Feature Generation ${status}`,
      activity_summary: [`Feature Generation ${status}`, taskLivePeriod(task), task.task_label].join(' · '),
      activity_details: taskLiveDetails(task, 'Materializes model-ready features from accepted source evidence.'),
    };
  }
  if (stageType === 'model_training' || stageType === 'model_generation' || stageType === 'model_task') {
    return {
      ...base,
      activity_type: 'model_generation',
      activity_label: `Model Build ${status}`,
      activity_summary: [`Model Build ${status}`, taskLivePeriod(task), task.task_label].join(' · '),
      activity_details: taskLiveDetails(task, 'Trains, evaluates, or packages the model layer for the current fold.'),
    };
  }
  return {
    ...base,
    activity_type: 'task_runtime_status',
    activity_label: `${startCase(stageType || 'Task')} ${status}`,
    activity_summary: [`${startCase(stageType || 'Task')} ${status}`, taskLivePeriod(task), task.task_label].join(' · '),
    activity_details: taskLiveDetails(task),
  };
}

function runtimeActivityDetailLines(activity?: HistoricalRuntimeActivityPayload | null): string[] {
  if (!activity) return [];
  const lines = [
    runtimeActivityMetrics(activity).join(' · '),
    activity.progress_label && activity.progress_hint ? `${activity.progress_label} · ${activity.progress_hint}` : activity.progress_label,
    ...(activity.activity_details ?? []),
    runtimeActivitySamples(activity),
    runtimeActivityTraceLine(activity),
  ].filter(Boolean) as string[];
  return Array.from(new Set(lines));
}

function runtimeActivitySupplementalLines(activity?: HistoricalRuntimeActivityPayload | null): string[] {
  if (!activity) return [];
  const primaryProgress =
    activity.progress_label && activity.progress_hint ? `${activity.progress_label} · ${activity.progress_hint}` : activity.progress_label || '';
  const summary = runtimeActivitySummary(activity);
  return runtimeActivityDetailLines(activity).filter((line) => {
    if (!line || line === summary || line === primaryProgress) return false;
    if (line.startsWith('Task progress ')) return false;
    return true;
  });
}

function runtimeActivityPreviewLine(activity?: HistoricalRuntimeActivityPayload | null): string {
  if (!activity) return '';
  return runtimeActivitySupplementalLines(activity)[0] || runtimeActivitySamples(activity) || '';
}

function taskShowsLiveSections(task: HistoricalTaskTimelineItemPayload): boolean {
  const status = String(task.status || '').toLowerCase();
  return task.task_state === 'current' || status === 'running';
}

function derivedTaskLiveActivity(task: HistoricalTaskTimelineItemPayload): HistoricalRuntimeActivityPayload | null {
  const explicitActivity = task.detail?.runtime_activity ?? null;
  const isRuntimeVisible = taskShowsLiveSections(task);
  if (explicitActivity && isRuntimeVisible) return explicitActivity;
  if (!isRuntimeVisible) return null;
  return taskLiveActivityByKind(task);
}

function taskLogTailEntries(task: HistoricalTaskTimelineItemPayload) {
  if (!taskShowsLiveSections(task)) return [];
  return task.detail?.log_tail?.entries ?? [];
}

function taskTargetLabel(task: HistoricalTaskTimelineItemPayload): string {
  const target = taskTargetSymbol(task);
  if (target) return target;
  return 'General';
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
  replay: 40,
  replay_review: 42,
  model_06_event_risk_governor: 45,
  model_evaluation: 40,
  promotion_review: 50,
  promotion_review_preparation: 50,
  maintenance: 60,
};

function monthOptionRank(value: string): number {
  if (value === 'unscheduled') return Number.MAX_SAFE_INTEGER;
  const foldMatch = /^(\d{4})-fold([1-9]\d*)$/u.exec(value);
  if (foldMatch) {
    const year = Number(foldMatch[1]);
    const foldNumber = Number(foldMatch[2]);
    if (Number.isFinite(year) && Number.isFinite(foldNumber)) return (year * 100 + (foldNumber * 6)) * 10 + 1;
  }
  const match = /^(\d{4}-\d{2})(?:\.\.(\d{4}-\d{2}))?$/u.exec(value);
  if (!match) return Number.MAX_SAFE_INTEGER - 1;
  const normalizedStart = Number(match[1].replace(/-/gu, ''));
  if (!Number.isFinite(normalizedStart)) return Number.MAX_SAFE_INTEGER - 1;
  return normalizedStart * 10 + (match[2] ? 1 : 0);
}

function taskStateOptionRank(value: string): number {
  return TASK_STATE_FILTER_ORDER[value] ?? Number.MAX_SAFE_INTEGER;
}

function taskOptionRank(value: string): number {
  const layerMatch = /^layer_(\d{2})_/u.exec(value);
  if (layerMatch) return Number(layerMatch[1]) * 10;
  const modelMatch = /^model_(\d{2})(?:[_.]|$)/u.exec(value);
  if (modelMatch) return Number(modelMatch[1]) * 10;
  if (value === 'model_group.replay') return 1000;
  if (value === 'model_group.replay_review') return 1010;
  if (value === 'model_group.model_06_event_risk_governor') return 1020;
  if (value === 'model_group.evaluation') return 1030;
  if (value === 'model_group.promotion') return 1040;
  if (value === 'model_group.maintenance') return 1050;
  const modelGroupLayerMatch = /^model_group\.model_(\d{2})(?:[_.]|$)/u.exec(value);
  if (modelGroupLayerMatch) return 1000 + Number(modelGroupLayerMatch[1]) * 10;
  const workTypeRank = WORK_TYPE_FILTER_ORDER[value];
  return workTypeRank === undefined ? Number.MAX_SAFE_INTEGER : 2000 + workTypeRank;
}

function targetOptionRank(value: string): number {
  if (value === 'not_targeted') return 0;
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
  return expandedTasks.has(row.key) ? 470 : 172;
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

function compactDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'Not recorded';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function taskRuntimeText(task: HistoricalTaskTimelineItemPayload): string {
  if (!task.started_at_utc) return 'Not started';
  const started = Date.parse(task.started_at_utc);
  if (!Number.isFinite(started)) return 'Not recorded';
  const ended = task.ended_at_utc ? Date.parse(task.ended_at_utc) : NaN;
  if (Number.isFinite(ended)) return compactDuration(ended - started);
  const status = String(task.status || '').toLowerCase();
  const isLive = task.task_state === 'current' || status === 'running';
  const elapsed = compactDuration(Date.now() - started);
  return isLive ? `${elapsed} running` : `${elapsed} elapsed`;
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
    return { percent: 0, label: '0% · Running', hint: task.reason || 'Task is running; no finer-grained counter has been reported yet.' };
  }
  if (status === 'ready') {
    return { percent: 0, label: '0% · Ready', hint: task.reason || 'Task is ready but has not started.' };
  }
  if (status === 'blocked') {
    return { percent: 0, label: '0% · Blocked', hint: task.reason || 'Task is waiting on blockers.' };
  }
  return { percent: 0, label: startCase(task.status || 'Not started'), hint: task.reason || 'No execution progress recorded yet.' };
}

function taskProgressView(task: HistoricalTaskTimelineItemPayload): { percent: number; label: string; hint: string; hasEvidence: boolean; failed: boolean; hasBar: boolean } {
  const progress = task.detail?.progress;
  if (!progress) {
    const fallback = taskProgressFallback(task);
    return {
      percent: Math.max(0, Math.min(100, fallback.percent)),
      label: fallback.label,
      hint: fallback.hint,
      hasEvidence: false,
      hasBar: String(task.status || '').toLowerCase() === 'succeeded' || String(task.status || '').toLowerCase() === 'not_applicable' || String(task.status || '').toLowerCase() === 'failed',
      failed: String(task.status || '').toLowerCase() === 'failed',
    };
  }
  const expected = Math.max(0, progress.expected_count ?? 0);
  const ready = Math.max(0, progress.ready_count ?? 0);
  const active = Math.max(0, progress.active_count ?? progress.current_count ?? ready);
  const usesCompletedTaskUnits = progress.progress_source === 'model_task_internal_stages';
  const displayCount = usesCompletedTaskUnits ? ready : Math.max(ready, active);
  const failedCount = Math.max(0, progress.failed_count ?? 0);
  const acceptedSkipCount = Math.max(0, progress.accepted_failed_count ?? 0);
  const usesRuntimeCursor = displayCount > ready && Boolean(progress.progress_display_basis);
  const pendingCount = usesRuntimeCursor
    ? Math.max(expected - Math.min(displayCount, expected) - failedCount - acceptedSkipCount, 0)
    : Math.max(0, progress.pending_count ?? 0);
  const percent = expected > 0 ? (Math.min(displayCount, expected) / expected) * 100 : 0;
  const unitLabel = progress.unit_label || 'units';
  const updated = progress.updated_at_utc ? ` · Updated ${formatTimestamp(progress.updated_at_utc)}` : '';
  const source = progress.progress_source ? ` · ${startCase(progress.progress_source)}` : '';
  const partitions = progress.expected_partition_count
    ? ` · Partitions ${progress.covered_partition_count ?? 0}/${progress.expected_partition_count}`
    : '';
  const basis = progress.progress_basis ? ` · ${progress.progress_basis}` : '';
  const cursorMonth = progress.active_month || progress.current_month || null;
  const cursor = cursorMonth ? ` · Current ${cursorMonth}` : '';
  const completed = !usesRuntimeCursor && displayCount > ready ? ` · Completed ${ready}/${expected}` : '';
  const displayBasis = progress.progress_display_basis ? ` · ${startCase(progress.progress_display_basis.replace('ready_count remains completed replay months', 'month completion updates at month close'))}` : '';
  const progressSource = String(progress.progress_source || '');
  const status = String(progress.status || task.status || '').toLowerCase();
  const hasMeasuredCounter = expected > 0 && progressSource !== 'stage_status';
  const terminalStatusEvidence = progressSource === 'stage_status' && ['complete', 'failed', 'succeeded', 'not_applicable'].includes(status);
  const hasEvidence = hasMeasuredCounter || terminalStatusEvidence;
  return {
    percent: Math.max(0, Math.min(100, percent)),
    label: `${formatPercent(percent)} · ${displayCount}/${expected} ${unitLabel}${cursor}`,
    hint: `Pending ${pendingCount} · Failed ${failedCount} · Accepted skips ${acceptedSkipCount}${completed}${partitions}${source}${updated}${basis}${displayBasis}`,
    hasEvidence,
    hasBar: hasEvidence,
    failed: failedCount > 0 || String(progress.status || task.status || '').toLowerCase() === 'failed',
  };
}

function normalizeModelRef(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object' || value === null) return '';
  const record = value as Record<string, unknown>;
  for (const key of ['model_ref', 'version_id', 'model_version', 'run_id', 'artifact_ref', 'id', 'path', 'ref']) {
    const candidate = record[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate);
  }
  return '';
}

function modelStatusSeverity(status?: string | null): string {
  const normalized = String(status ?? '').toLowerCase();
  if (['active', 'live', 'approved', 'promoted', 'baseline_active', 'shadow', 'eligible', 'succeeded', 'completed', 'ready'].includes(normalized)) return 'low';
  if (['running', 'candidate', 'review_required', 'in_review', 'pending', 'not_started', 'missing'].includes(normalized)) return 'info';
  if (['retiring', 'superseded', 'deferred', 'blocked'].includes(normalized)) return 'medium';
  if (['failed', 'rejected', 'revoked', 'eliminated'].includes(normalized)) return 'high';
  return 'info';
}

function activeModelRef(runtimeChart: ExecutionRuntimeStatusChartPayload): string | null {
  const pointer = runtimeChart.active_model_pointer;
  if (!pointer) return null;
  return normalizeModelRef(pointer.selected_active_model_ref) || normalizeModelRef(pointer.new_active_config_ref) || null;
}

function groupMetric(summary: string | null | undefined, key: string): string | null {
  if (!summary) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`${escaped}=([^;]+)`, 'iu').exec(summary);
  return match?.[1]?.trim() ?? null;
}

function groupPromotionVersions(layerChart: ModelLayerReadinessChartPayload, promotionChart: ModelPromotionPostureChartPayload): ModelGroupPromotionVersionPayload[] {
  const fromPromotion = promotionChart.group_versions ?? [];
  const fromLayer = Array.isArray(layerChart.group_versions) ? layerChart.group_versions as ModelGroupPromotionVersionPayload[] : [];
  if (fromPromotion.length) return fromPromotion;
  if (fromLayer.length) return fromLayer;
  return [];
}

function groupPromotionExclusions(promotionChart: ModelPromotionPostureChartPayload): Array<Record<string, unknown>> {
  return Array.isArray(promotionChart.excluded_group_versions) ? promotionChart.excluded_group_versions : [];
}

function modelIdentity(item: Pick<ModelPromotionItemPayload, 'activation_status' | 'promotion_status'> | ModelGroupPromotionVersionPayload): string {
  const identity = 'identity' in item ? String(item.identity ?? '').toLowerCase() : '';
  if (identity) return identity;
  const activation = String(item.activation_status ?? '').toLowerCase();
  const status = String('decision_status' in item ? item.decision_status ?? '' : item.promotion_status ?? '').toLowerCase();
  if (activation === 'active' || status === 'active') return 'active';
  if (status === 'baseline_active') return 'active';
  if (['eligible', 'shadow', 'approved', 'promoted'].includes(status)) return 'shadow';
  if (['deferred', 'rejected', 'revoked', 'superseded', 'blocked'].includes(status)) return 'retired';
  return 'candidate';
}

function metricNumber(metrics: Record<string, unknown> | undefined | null, key: string): number | null {
  const value = metrics?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function versionMetricNumber(version: ModelGroupPromotionVersionPayload, key: string): number | null {
  const metrics = version.metrics;
  const direct = metricNumber(metrics, key);
  if (direct !== null) return direct;
  const fallbackSections = [
    'data_integrity_diagnostics',
    'economic_diagnostics',
    'calibration_diagnostics',
    'predictive_diagnostics',
    'feature_diagnostics',
  ];
  for (const sectionKey of fallbackSections) {
    const value = metricNumber(nestedRecord(metrics, sectionKey), key);
    if (value !== null) return value;
  }
  return null;
}

function compactVersionLabel(version: ModelGroupPromotionVersionPayload, index: number): string {
  const label = String(version.version_label ?? '').trim();
  if (label) return label;
  const target = String(version.target_symbol ?? '').trim().toUpperCase();
  const compactFold = /(?<year>20\d{2})[-_ ]?fold[-_ ]?(?<fold>\d+)/iu.exec(String(version.fold_id ?? ''));
  if (compactFold?.groups) {
    const foldLabel = `${compactFold.groups.year} fold${Number(compactFold.groups.fold)}`;
    return target ? `${target} ${foldLabel}` : foldLabel;
  }
  const rangeFold = /(?<year>20\d{2})-(?<startMonth>\d{2})_\k<year>-\d{2}/u.exec(String(version.fold_id ?? version.candidate_model_ref ?? ''));
  if (rangeFold?.groups) {
    const foldLabel = `${rangeFold.groups.year} fold${Math.floor((Number(rangeFold.groups.startMonth) - 1) / 6) + 1}`;
    return target ? `${target} ${foldLabel}` : foldLabel;
  }
  return String(version.version_id ?? '').trim() || `v${index + 1}`;
}

function versionMetricSeries(versions: ModelGroupPromotionVersionPayload[], key: string): Array<{ label: string; value: number; status?: string | null }> {
  const points: Array<{ label: string; value: number; status?: string | null }> = [];
  versions.forEach((version, index) => {
    const value = versionMetricNumber(version, key);
    if (value !== null) {
      points.push({ label: compactVersionLabel(version, index), value, status: version.decision_status });
    }
  });
  return points;
}

function versionStableId(version: ModelGroupPromotionVersionPayload, index: number): string {
  return String(version.version_id ?? version.candidate_model_ref ?? version.promotion_run_id ?? index);
}

function identityCounts(versions: ModelGroupPromotionVersionPayload[]): Record<string, number> {
  return versions.reduce<Record<string, number>>((counts, version) => {
    const identity = modelIdentity(version);
    counts[identity] = (counts[identity] ?? 0) + 1;
    return counts;
  }, {});
}

function formatMetricValue(value: number | null, digits = 3): string {
  return value === null ? 'Not reported' : value.toFixed(digits);
}

function latestVersionWithDiagnostic(versions: ModelGroupPromotionVersionPayload[], key: 'pca' | 'pcoa'): ModelGroupPromotionVersionPayload | null {
  for (const version of [...versions].reverse()) {
    const diagnostics = featureDiagnostics(version);
    const section = diagnostics?.[key];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      const points = (section as Record<string, unknown>).points;
      if (Array.isArray(points) && points.length) {
        return version;
      }
    }
  }
  return null;
}

function nestedRecord(record: Record<string, unknown> | undefined | null, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function nestedArray(record: Record<string, unknown> | undefined | null, key: string): Array<Record<string, unknown>> {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function featureDiagnostics(version: ModelGroupPromotionVersionPayload | null): Record<string, unknown> | null {
  const diagnostics = version?.metrics?.feature_diagnostics;
  return diagnostics && typeof diagnostics === 'object' && !Array.isArray(diagnostics) ? diagnostics as Record<string, unknown> : null;
}

function decisionVariableDiagnostics(version: ModelGroupPromotionVersionPayload | null): Record<string, unknown> | null {
  const diagnostics = version?.metrics?.decision_variable_schema_diagnostics;
  return diagnostics && typeof diagnostics === 'object' && !Array.isArray(diagnostics) ? diagnostics as Record<string, unknown> : null;
}

function modelScorecards(version: ModelGroupPromotionVersionPayload | null): Record<string, unknown> | null {
  const scorecards = version?.metrics?.scorecards;
  return scorecards && typeof scorecards === 'object' && !Array.isArray(scorecards) ? scorecards as Record<string, unknown> : null;
}

function evaluationDisagreementReport(version: ModelGroupPromotionVersionPayload | null): Record<string, unknown> | null {
  const report = version?.metrics?.evaluation_disagreement_report;
  return report && typeof report === 'object' && !Array.isArray(report) ? report as Record<string, unknown> : null;
}

function scorecardSection(version: ModelGroupPromotionVersionPayload | null, key: string): Record<string, unknown> | null {
  return nestedRecord(modelScorecards(version), key);
}

type MetricBarSpec = {
  key: string;
  label: string;
  scale?: number;
};

function metricBarSeries(record: Record<string, unknown> | undefined | null, specs: MetricBarSpec[]): Array<{ label: string; value: number }> {
  return specs
    .map((spec) => {
      const value = metricNumber(record, spec.key);
      return { label: spec.label, value: value === null ? null : value * (spec.scale ?? 1) };
    })
    .filter((point): point is { label: string; value: number } => point.value !== null);
}

function coverageValues(diagnostics: Record<string, unknown> | null, field: string): Record<string, number> {
  const coverage = nestedRecord(diagnostics, 'coverage');
  const fieldCoverage = nestedRecord(coverage, field);
  const values = nestedRecord(fieldCoverage, 'values');
  if (!values) return {};
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, typeof value === 'number' ? value : Number(value)])
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function normalizedVariableSamples(diagnostics: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return nestedArray(diagnostics, 'normalized_row_samples');
}

function scoreDecileReturnPoints(version: ModelGroupPromotionVersionPayload | null): Array<{ label: string; x: number; y: number }> {
  const ranking = scorecardSection(version, 'ranking_calibration');
  return nestedArray(ranking, 'score_decile_return')
    .map((point) => ({
      label: `D${metricNumber(point, 'decile')?.toFixed(0) ?? ''}`,
      x: metricNumber(point, 'decile'),
      y: metricNumber(point, 'excess_return_total') ?? metricNumber(point, 'net_return_total'),
    }))
    .filter((point): point is { label: string; x: number; y: number } => point.x !== null && point.y !== null)
    .sort((left, right) => left.x - right.x);
}

function diagnosticPoints(version: ModelGroupPromotionVersionPayload | null, key: 'pca' | 'pcoa'): Array<Record<string, unknown>> {
  const diagnostics = featureDiagnostics(version);
  const section = diagnostics?.[key];
  if (!section || typeof section !== 'object' || Array.isArray(section)) return [];
  const points = (section as Record<string, unknown>).points;
  return Array.isArray(points) ? points.filter((point): point is Record<string, unknown> => Boolean(point) && typeof point === 'object' && !Array.isArray(point)) : [];
}

function diagnosticExplainedVariance(version: ModelGroupPromotionVersionPayload | null, key: 'pca' | 'pcoa'): string {
  const diagnostics = featureDiagnostics(version);
  const section = diagnostics?.[key];
  if (!section || typeof section !== 'object' || Array.isArray(section)) return 'Variance not reported';
  const ratio = (section as Record<string, unknown>).explained_variance_ratio;
  if (!Array.isArray(ratio)) return 'Variance not reported';
  const values = ratio.map((value) => typeof value === 'number' ? value : Number(value)).filter((value) => Number.isFinite(value));
  if (!values.length) return 'Variance not reported';
  return `Top axes ${(values.reduce((sum, value) => sum + value, 0) * 100).toFixed(1)}%`;
}

function ellipseForPoints(points: Array<{ x: number; y: number }>) {
  if (points.length < 4) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const varianceX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) / points.length;
  const varianceY = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0) / points.length;
  if (!Number.isFinite(varianceX) || !Number.isFinite(varianceY) || (varianceX === 0 && varianceY === 0)) return null;
  return { cx: meanX, cy: meanY, rx: Math.sqrt(varianceX) * 2, ry: Math.sqrt(varianceY) * 2 };
}

function selectedDiagnosticSeries(
  version: ModelGroupPromotionVersionPayload | null,
  kind: 'monthly_auroc' | 'monthly_brier' | 'monthly_return' | 'monthly_drawdown' | 'calibration' | 'threshold_return' | 'cost_sensitivity' | 'silhouette',
): Array<{ name: string; points: Array<{ label: string; value: number }> }> {
  const metrics = version?.metrics;
  if (!metrics) return [];
  const temporal = nestedRecord(metrics, 'temporal_stability_diagnostics');
  const predictive = nestedRecord(metrics, 'predictive_diagnostics');
  const calibration = nestedRecord(metrics, 'calibration_diagnostics');
  const economic = nestedRecord(metrics, 'economic_diagnostics');
  if (kind.startsWith('monthly_')) {
    const key = kind === 'monthly_auroc' ? 'auroc' : kind === 'monthly_brier' ? 'brier_score' : kind === 'monthly_return' ? 'net_return_total' : 'max_drawdown';
    const points = nestedArray(temporal, 'slices')
      .map((slice) => ({ label: String(slice.month ?? ''), value: metricNumber(slice, key) }))
      .filter((point): point is { label: string; value: number } => Boolean(point.label) && point.value !== null);
    return points.length ? [{ name: startCase(key), points }] : [];
  }
  if (kind === 'calibration') {
    const bins = nestedArray(calibration, 'bins');
    const hitRate = bins
      .map((bin) => ({ label: `${formatMetricValue(metricNumber(bin, 'lower'), 1)}-${formatMetricValue(metricNumber(bin, 'upper'), 1)}`, value: metricNumber(bin, 'hit_rate') }))
      .filter((point): point is { label: string; value: number } => point.value !== null);
    const meanScore = bins
      .map((bin) => ({ label: `${formatMetricValue(metricNumber(bin, 'lower'), 1)}-${formatMetricValue(metricNumber(bin, 'upper'), 1)}`, value: metricNumber(bin, 'mean_score') }))
      .filter((point): point is { label: string; value: number } => point.value !== null);
    return [
      ...(hitRate.length ? [{ name: 'Observed hit rate', points: hitRate }] : []),
      ...(meanScore.length ? [{ name: 'Mean score', points: meanScore }] : []),
    ];
  }
  if (kind === 'threshold_return') {
    const points = nestedArray(predictive, 'threshold_return_curve')
      .map((point) => ({ label: formatMetricValue(metricNumber(point, 'threshold'), 1), value: metricNumber(point, 'return_per_selected') }))
      .filter((point): point is { label: string; value: number } => point.value !== null);
    return points.length ? [{ name: 'Return per selected', points }] : [];
  }
  if (kind === 'cost_sensitivity') {
    const costs = nestedRecord(economic, 'cost_sensitivity');
    const points = Object.entries(costs ?? {})
      .map(([label, value]) => ({ label, value: typeof value === 'number' ? value : Number(value) }))
      .filter((point) => Number.isFinite(point.value));
    return points.length ? [{ name: 'Net return by cost', points }] : [];
  }
  const silhouette = nestedRecord(featureDiagnostics(version), 'silhouette');
  const points = [
    { label: 'Outcome', value: metricNumber(silhouette, 'outcome_label') },
    { label: 'Decision', value: metricNumber(silhouette, 'decision_action') },
    { label: 'Side', value: metricNumber(silhouette, 'decision_intended_side') },
    { label: 'Action', value: metricNumber(silhouette, 'decision_intended_action') },
  ].filter((point): point is { label: string; value: number } => point.value !== null);
  return points.length ? [{ name: 'Silhouette', points }] : [];
}

function uniqueSilhouettePoints(points: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> {
  const seenDecisionSeparations = new Set<string>();
  return points.filter((point) => {
    if (point.label === 'Outcome') return true;
    const key = point.value.toFixed(6);
    if (seenDecisionSeparations.has(key)) return false;
    seenDecisionSeparations.add(key);
    return true;
  });
}

function equivalentSilhouetteNote(points: Array<{ label: string; value: number }>): string | null {
  const groups = new Map<string, string[]>();
  for (const point of points) {
    const key = point.value.toFixed(6);
    groups.set(key, [...(groups.get(key) ?? []), point.label]);
  }
  const duplicate = [...groups.entries()]
    .map(([value, labels]) => ({ value, labels }))
    .filter((group) => group.labels.length > 1)
    .sort((left, right) => right.labels.length - left.labels.length)[0];
  if (!duplicate) return null;
  return `${duplicate.labels.join(' / ')} have the same feature-space separation in this run; the selected rows form an equivalent split, so the bars intentionally match.`;
}

function sliceRowCountValues(version: ModelGroupPromotionVersionPayload | null, key: string): Record<string, number> {
  const rows = nestedArray(scorecardSection(version, 'slices'), key);
  return Object.fromEntries(
    rows
      .map((row) => [String(row.value ?? 'unknown'), metricNumber(row, 'row_count')])
      .filter((entry): entry is [string, number] => Boolean(entry[0]) && entry[1] !== null),
  );
}

function diagnosticUnavailableReason(version: ModelGroupPromotionVersionPayload | null, key: string): string | null {
  const availability = nestedRecord(version?.metrics, 'diagnostic_availability');
  const panel = nestedRecord(availability, key);
  if (!panel) return null;
  const status = String(panel.status ?? '');
  if (status !== 'unavailable') return null;
  return startCase(String(panel.reason_code ?? 'diagnostics unavailable'));
}

function selectedRocCurve(version: ModelGroupPromotionVersionPayload | null): Array<{ fpr: number; tpr: number; threshold: number | null }> {
  const predictive = nestedRecord(version?.metrics, 'predictive_diagnostics');
  const published = nestedArray(predictive, 'roc_curve')
    .map((point) => ({
      fpr: metricNumber(point, 'false_positive_rate'),
      tpr: metricNumber(point, 'true_positive_rate'),
      threshold: metricNumber(point, 'threshold'),
    }))
    .filter((point): point is { fpr: number; tpr: number; threshold: number | null } => point.fpr !== null && point.tpr !== null)
    .map((point) => ({ ...point, fpr: clamp01(point.fpr), tpr: clamp01(point.tpr) }));
  if (published.length >= 2) {
    return [...published].sort((left, right) => left.fpr - right.fpr || left.tpr - right.tpr);
  }
  const fallback = nestedArray(predictive, 'confusion_by_threshold')
    .map((point) => {
      const falsePositive = metricNumber(point, 'false_positive') ?? 0;
      const trueNegative = metricNumber(point, 'true_negative') ?? 0;
      const truePositive = metricNumber(point, 'true_positive') ?? 0;
      const falseNegative = metricNumber(point, 'false_negative') ?? 0;
      const negatives = falsePositive + trueNegative;
      const positives = truePositive + falseNegative;
      return {
        fpr: negatives ? clamp01(falsePositive / negatives) : null,
        tpr: positives ? clamp01(truePositive / positives) : null,
        threshold: metricNumber(point, 'threshold'),
      };
    })
    .filter((point): point is { fpr: number; tpr: number; threshold: number | null } => point.fpr !== null && point.tpr !== null);
  if (!fallback.length) return [];
  return [
    { fpr: 0, tpr: 0, threshold: null },
    ...fallback,
    { fpr: 1, tpr: 1, threshold: null },
  ].sort((left, right) => left.fpr - right.fpr || left.tpr - right.tpr);
}

function temporalDiagnosticPoints(
  version: ModelGroupPromotionVersionPayload | null,
  metricKey: string,
): Array<{ label: string; value: number }> {
  const temporal = nestedRecord(version?.metrics, 'temporal_stability_diagnostics');
  return nestedArray(temporal, 'slices')
    .map((slice) => ({ label: String(slice.month ?? ''), value: metricNumber(slice, metricKey) }))
    .filter((point): point is { label: string; value: number } => Boolean(point.label) && point.value !== null);
}

function cumulativePoints(points: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> {
  let cumulative = 0;
  return points.map((point) => {
    cumulative += point.value;
    return { label: point.label, value: cumulative };
  });
}

function compactMonthLabel(label: string): string {
  const match = label.match(/^(\d{4})-(\d{2})$/);
  if (!match) return label;
  return `${match[1].slice(2)}-${match[2]}`;
}

function calibrationCurvePoints(version: ModelGroupPromotionVersionPayload | null): Array<{ label: string; score: number; hitRate: number }> {
  const calibration = nestedRecord(version?.metrics, 'calibration_diagnostics');
  return nestedArray(calibration, 'bins')
    .map((bin) => {
      const score = metricNumber(bin, 'mean_score');
      const hitRate = metricNumber(bin, 'hit_rate');
      const lower = metricNumber(bin, 'lower');
      const upper = metricNumber(bin, 'upper');
      return {
        label: `${formatMetricValue(lower, 1)}-${formatMetricValue(upper, 1)}`,
        score,
        hitRate,
      };
    })
    .filter((point): point is { label: string; score: number; hitRate: number } => point.score !== null && point.hitRate !== null)
    .sort((left, right) => left.score - right.score);
}

function thresholdReturnPoints(version: ModelGroupPromotionVersionPayload | null): Array<{ label: string; x: number; y: number; selectedCount: number | null }> {
  const predictive = nestedRecord(version?.metrics, 'predictive_diagnostics');
  return nestedArray(predictive, 'threshold_return_curve')
    .map((point) => ({
      label: formatMetricValue(metricNumber(point, 'threshold'), 2),
      x: metricNumber(point, 'threshold'),
      y: metricNumber(point, 'return_per_selected'),
      selectedCount: metricNumber(point, 'selected_count') ?? metricNumber(point, 'count'),
    }))
    .filter((point): point is { label: string; x: number; y: number; selectedCount: number | null } => point.x !== null && point.y !== null)
    .sort((left, right) => left.x - right.x);
}

function costSensitivityPoints(version: ModelGroupPromotionVersionPayload | null): Array<{ label: string; x: number; y: number }> {
  const economic = nestedRecord(version?.metrics, 'economic_diagnostics');
  const costs = nestedRecord(economic, 'cost_sensitivity');
  const factorForLabel = (label: string, index: number): number => {
    const match = /(?<factor>\d+(?:\.\d+)?)x/iu.exec(label);
    if (match?.groups?.factor) return Number(match.groups.factor);
    if (/zero|0/i.test(label)) return 0;
    if (/base|normal|1x/i.test(label)) return 1;
    return index + 1;
  };
  return Object.entries(costs ?? {})
    .map(([label, value], index) => ({ label, x: factorForLabel(label, index), y: typeof value === 'number' ? value : Number(value) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((left, right) => left.x - right.x);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ModelLifecycleStat({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string | number;
  status?: string | null;
  hint?: string | null;
}) {
  return (
    <section className="model-lifecycle-stat">
      <div>
        <span>{label}</span>
        <strong>{displayValue(value)}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      {status ? <StatusPill status={status} severity={modelStatusSeverity(status)} /> : null}
    </section>
  );
}

type ScatterGroupKey = 'outcome_label' | 'decision_action' | 'decision_intended_side' | 'decision_intended_action' | 'decision_disposition';

const SCATTER_GROUP_OPTIONS: Array<{ key: ScatterGroupKey; label: string }> = [
  { key: 'outcome_label', label: 'Outcome' },
  { key: 'decision_action', label: 'Decision' },
  { key: 'decision_intended_side', label: 'Side' },
  { key: 'decision_intended_action', label: 'Action' },
  { key: 'decision_disposition', label: 'Disposition' },
];

const SCATTER_GROUP_COLORS = ['#34d399', '#f87171', '#38bdf8', '#fbbf24', '#a78bfa', '#fb7185', '#94a3b8'];

function scatterPartitionSignature(
  points: Array<Record<ScatterGroupKey, string>>,
  key: ScatterGroupKey,
): string | null {
  if (points.length < 2) return null;
  const groupIds = new Map<string, number>();
  const signature = points.map((point) => {
    const value = String(point[key] || 'unknown');
    if (!groupIds.has(value)) groupIds.set(value, groupIds.size);
    return groupIds.get(value);
  });
  return groupIds.size > 1 ? signature.join('|') : null;
}

function visibleScatterGroupOptions(
  points: Array<Record<ScatterGroupKey, string>>,
): Array<{ key: ScatterGroupKey; label: string }> {
  const seenSignatures = new Set<string>();
  const options: Array<{ key: ScatterGroupKey; label: string }> = [];
  for (const option of SCATTER_GROUP_OPTIONS) {
    const signature = scatterPartitionSignature(points, option.key);
    if (!signature) continue;
    if (signature && seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    options.push(option);
  }
  return options.length ? options : [SCATTER_GROUP_OPTIONS[0]];
}

function resolvedScatterGroupKey(
  points: Array<Record<ScatterGroupKey, string>>,
  groupKey: ScatterGroupKey,
  options: Array<{ key: ScatterGroupKey; label: string }>,
): ScatterGroupKey {
  if (options.some((option) => option.key === groupKey)) return groupKey;
  const selectedSignature = scatterPartitionSignature(points, groupKey);
  const equivalent = selectedSignature
    ? options.find((option) => scatterPartitionSignature(points, option.key) === selectedSignature)
    : null;
  return equivalent?.key ?? options[0]?.key ?? groupKey;
}

function FeatureScatterChart({
  title,
  version,
  diagnosticKey,
  groupKey,
  onGroupKeyChange,
  emptyLabel,
}: {
  title: string;
  version: ModelGroupPromotionVersionPayload | null;
  diagnosticKey: 'pca' | 'pcoa';
  groupKey: ScatterGroupKey;
  onGroupKeyChange: (key: ScatterGroupKey) => void;
  emptyLabel: string;
}) {
  const points = diagnosticPoints(version, diagnosticKey)
    .map((point) => ({
      x: metricNumber(point, 'x'),
      y: metricNumber(point, 'y'),
      outcome_label: String(point.outcome_label ?? 'unknown'),
      decision_action: String(point.decision_action ?? ''),
      decision_intended_side: String(point.decision_intended_side ?? 'unknown'),
      decision_intended_action: String(point.decision_intended_action ?? 'unknown'),
      decision_disposition: String(point.decision_disposition ?? 'unknown'),
      target: String(point.target_ref ?? ''),
      timestamp: String(point.timestamp ?? ''),
    }))
    .filter((point): point is {
      x: number;
      y: number;
      outcome_label: string;
      decision_action: string;
      decision_intended_side: string;
      decision_intended_action: string;
      decision_disposition: string;
      target: string;
      timestamp: string;
    } => point.x !== null && point.y !== null);
  if (!points.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">{title}</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 260;
  const padding = 32;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const projectX = (value: number) => padding + ((value - minX) / xRange) * (width - padding * 2);
  const projectY = (value: number) => height - padding - ((value - minY) / yRange) * (height - padding * 2);
  const visibleGroupOptions = visibleScatterGroupOptions(points);
  const effectiveGroupKey = resolvedScatterGroupKey(points, groupKey, visibleGroupOptions);
  const groupCounts = points.reduce<Record<string, number>>((counts, point) => {
    const value = String(point[effectiveGroupKey] || 'unknown');
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
  const groupNames = Object.entries(groupCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name]) => name);
  const colorForGroup = (group: string): string => {
    const index = groupNames.indexOf(group);
    return SCATTER_GROUP_COLORS[index >= 0 ? index % SCATTER_GROUP_COLORS.length : SCATTER_GROUP_COLORS.length - 1];
  };
  const ellipseGroups = groupNames.map((group) => {
    const ellipse = ellipseForPoints(points.filter((point) => String(point[effectiveGroupKey] || 'unknown') === group));
    if (!ellipse) return null;
    return {
      group,
      cx: projectX(ellipse.cx),
      cy: projectY(ellipse.cy),
      rx: Math.max(4, (ellipse.rx / xRange) * (width - padding * 2)),
      ry: Math.max(4, (ellipse.ry / yRange) * (height - padding * 2)),
    };
  }).filter((ellipse): ellipse is { group: string; cx: number; cy: number; rx: number; ry: number } => Boolean(ellipse));
  return (
    <section className="model-chart-panel">
      <div className="scatter-chart-head">
        <span className="model-chart-title">{title}</span>
        <div className="scatter-summary">
          <select value={effectiveGroupKey} onChange={(event) => onGroupKeyChange(event.target.value as ScatterGroupKey)} aria-label={`${title} grouping`}>
            {visibleGroupOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          {groupNames.slice(0, 4).map((group) => <span key={group}><i style={{ background: colorForGroup(group) }} />{startCase(group)} · {groupCounts[group]}</span>)}
          <strong>{diagnosticExplainedVariance(version, diagnosticKey)}</strong>
        </div>
      </div>
      <svg className="model-scatter-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} />
        <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} />
        {ellipseGroups.map((ellipse) => (
          <ellipse
            key={ellipse.group}
            cx={ellipse.cx}
            cy={ellipse.cy}
            rx={ellipse.rx}
            ry={ellipse.ry}
            style={{ stroke: colorForGroup(ellipse.group) }}
          />
        ))}
        {points.map((point, index) => (
          <circle
            key={`${point.timestamp}-${index}`}
            cx={projectX(point.x)}
            cy={projectY(point.y)}
            r="4"
            style={{ fill: colorForGroup(String(point[effectiveGroupKey] || 'unknown')) }}
          >
            <title>{`${point.target || 'target'} ${point.decision_intended_side}/${point.decision_intended_action} ${point.decision_disposition} ${point.timestamp || ''}`}</title>
          </circle>
        ))}
      </svg>
    </section>
  );
}

function MiniMetricBarChart({
  title,
  series,
  emptyLabel,
}: {
  title: string;
  series: Array<{ label: string; value: number; status?: string | null }>;
  emptyLabel: string;
}) {
  if (!series.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">{title}</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 230;
  const padding = 38;
  const bottomPadding = 54;
  const values = series.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const barGap = 12;
  const barWidth = Math.max(16, ((width - padding * 2) / series.length) - barGap);
  const projectY = (value: number) => height - bottomPadding - ((value - minValue) / range) * (height - padding - bottomPadding);
  const zeroY = projectY(0);
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title">{title}</div>
      <svg className="model-bar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} />
        <line x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        {series.map((point, index) => {
          const slot = (width - padding * 2) / series.length;
          const x = padding + index * slot + (slot - barWidth) / 2;
          const y = Math.min(projectY(point.value), zeroY);
          const barHeight = Math.max(2, Math.abs(projectY(point.value) - zeroY));
          const labelX = x + barWidth / 2;
          const showLabel = series.length <= 8 || index === 0 || index === series.length - 1 || index % Math.ceil(series.length / 8) === 0;
          return (
            <g key={`${point.label}-${point.value}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" className={`model-bar-${modelIdentity({ promotion_status: point.status })}`} />
              {showLabel ? <text x={labelX} y={height - 26} textAnchor="middle">{point.label}</text> : null}
              {showLabel ? <text x={labelX} y={Math.max(16, y - 8)} textAnchor="middle">{point.value.toFixed(3)}</text> : null}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function DiagnosticLineChart({
  title,
  series,
  emptyLabel,
}: {
  title: string;
  series: Array<{ name: string; points: Array<{ label: string; value: number }> }>;
  emptyLabel: string;
}) {
  const nonEmpty = series.filter((item) => item.points.length);
  if (!nonEmpty.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">{title}</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 230;
  const padding = 38;
  const bottomPadding = 54;
  const values = nonEmpty.flatMap((item) => item.points.map((point) => point.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const maxLength = Math.max(...nonEmpty.map((item) => item.points.length));
  const project = (point: { value: number }, index: number) => {
    const x = padding + (maxLength === 1 ? 0.5 : index / (maxLength - 1)) * (width - padding * 2);
    const y = height - bottomPadding - ((point.value - minValue) / range) * (height - padding - bottomPadding);
    return { x, y };
  };
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">{title}</span>
        <div className="chart-legend">
          {nonEmpty.map((item, index) => <span className={`legend-${index}`} key={item.name}>{item.name}</span>)}
        </div>
      </div>
      <svg className="model-line-chart diagnostic-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        {nonEmpty.map((item, seriesIndex) => {
          const projected = item.points.map((point, index) => ({ ...point, ...project(point, index) }));
          return (
            <g key={item.name} className={`diagnostic-series-${seriesIndex}`}>
              <polyline points={projected.map((point) => `${point.x},${point.y}`).join(' ')} />
              {projected.map((point, index) => (
                <g key={`${item.name}-${point.label}`}>
                  <circle cx={point.x} cy={point.y} r="4" />
                  {index === 0 || index === projected.length - 1 || projected.length <= 8 ? <text x={point.x} y={height - 26} textAnchor="middle">{point.label}</text> : null}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function RocCurveChart({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const points = selectedRocCurve(version);
  if (!version || points.length < 2) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">AUROC</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 280;
  const padding = 42;
  const bottomPadding = 58;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;
  const projectX = (fpr: number) => padding + fpr * chartWidth;
  const projectY = (tpr: number) => padding + (1 - tpr) * chartHeight;
  const projected = points.map((point) => ({ ...point, x: projectX(point.fpr), y: projectY(point.tpr) }));
  const bestPoint = projected.reduce((best, point) => (point.tpr - point.fpr > best.tpr - best.fpr ? point : best), projected[0]);
  const linePoints = projected.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = [
    `${projectX(0)},${projectY(0)}`,
    ...projected.map((point) => `${point.x},${point.y}`),
    `${projectX(1)},${projectY(0)}`,
  ].join(' ');
  const auc = metricNumber(version.metrics, 'auroc');
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">AUROC · {compactVersionLabel(version, 0)}</span>
        <strong>{auc === null ? 'AUC not reported' : `AUC ${auc.toFixed(3)}`}</strong>
      </div>
      <svg className="model-roc-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ROC curve">
        <line className="roc-axis" x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        <line className="roc-axis" x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line className="roc-random-line" x1={projectX(0)} y1={projectY(0)} x2={projectX(1)} y2={projectY(1)} />
        <polygon className="roc-area" points={areaPoints} />
        <polyline className="roc-line" points={linePoints} />
        <circle className="roc-best-point" cx={bestPoint.x} cy={bestPoint.y} r="5">
          <title>{`FPR ${bestPoint.fpr.toFixed(3)}, TPR ${bestPoint.tpr.toFixed(3)}${bestPoint.threshold === null ? '' : `, threshold ${bestPoint.threshold.toFixed(3)}`}`}</title>
        </circle>
        <text x={padding} y={height - 20}>False positive rate</text>
        <text className="roc-y-label" x={18} y={padding + chartHeight / 2} transform={`rotate(-90 18 ${padding + chartHeight / 2})`}>True positive rate</text>
        <text x={padding} y={height - bottomPadding + 22}>0.0</text>
        <text x={width - padding} y={height - bottomPadding + 22} textAnchor="end">1.0</text>
        <text x={padding - 10} y={height - bottomPadding} textAnchor="end">0.0</text>
        <text x={padding - 10} y={padding + 4} textAnchor="end">1.0</text>
      </svg>
    </section>
  );
}

function TemporalDiagnosticCurve({
  title,
  version,
  metricKey,
  mode,
  emptyLabel,
}: {
  title: string;
  version: ModelGroupPromotionVersionPayload | null;
  metricKey: string;
  mode?: 'cumulative' | 'raw';
  emptyLabel: string;
}) {
  const rawPoints = temporalDiagnosticPoints(version, metricKey);
  const points = mode === 'cumulative' ? cumulativePoints(rawPoints) : rawPoints;
  if (!version || !points.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">{title}</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 250;
  const padding = 38;
  const bottomPadding = 54;
  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const projectX = (index: number) => padding + (points.length === 1 ? 0.5 : index / (points.length - 1)) * (width - padding * 2);
  const projectY = (value: number) => height - bottomPadding - ((value - minValue) / range) * (height - padding - bottomPadding);
  const projected = points.map((point, index) => ({ ...point, x: projectX(index), y: projectY(point.value) }));
  const zeroY = projectY(0);
  const linePoints = projected.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = [
    `${projected[0].x},${zeroY}`,
    ...projected.map((point) => `${point.x},${point.y}`),
    `${projected[projected.length - 1].x},${zeroY}`,
  ].join(' ');
  const finalValue = projected[projected.length - 1]?.value ?? null;
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">{title} · {compactVersionLabel(version, 0)}</span>
        <strong>{formatMetricValue(finalValue)}</strong>
      </div>
      <svg className="model-diagnostic-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line className="curve-axis" x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        <line className="curve-axis" x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line className="curve-zero-line" x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} />
        <polygon className="curve-area" points={areaPoints} />
        <polyline className="curve-line" points={linePoints} />
        {projected.map((point, index) => {
          const showLabel = projected.length <= 8 || index === 0 || index === projected.length - 1 || index % Math.ceil(projected.length / 6) === 0;
          return (
            <g key={`${point.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r="4">
                <title>{`${point.label}: ${point.value.toFixed(4)}`}</title>
              </circle>
              {showLabel ? <text x={point.x} y={height - 24} textAnchor="middle">{compactMonthLabel(point.label)}</text> : null}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function CalibrationReliabilityChart({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const points = calibrationCurvePoints(version);
  if (!version || !points.length) {
    return (
      <DiagnosticLineChart
        title={version ? `Calibration · ${compactVersionLabel(version, 0)}` : 'Calibration'}
        series={selectedDiagnosticSeries(version, 'calibration')}
        emptyLabel={emptyLabel}
      />
    );
  }
  const width = 680;
  const height = 280;
  const padding = 42;
  const bottomPadding = 58;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;
  const projectX = (score: number) => padding + clamp01(score) * chartWidth;
  const projectY = (hitRate: number) => padding + (1 - clamp01(hitRate)) * chartHeight;
  const projected = points.map((point) => ({ ...point, x: projectX(point.score), y: projectY(point.hitRate) }));
  const linePoints = projected.map((point) => `${point.x},${point.y}`).join(' ');
  const ece = metricNumber(version.metrics, 'ece');
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Calibration · {compactVersionLabel(version, 0)}</span>
        <strong>{ece === null ? 'ECE not reported' : `ECE ${ece.toFixed(3)}`}</strong>
      </div>
      <svg className="model-calibration-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Calibration reliability curve">
        <line className="curve-axis" x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        <line className="curve-axis" x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line className="calibration-perfect-line" x1={projectX(0)} y1={projectY(0)} x2={projectX(1)} y2={projectY(1)} />
        <polyline className="calibration-line" points={linePoints} />
        {projected.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4.5">
            <title>{`${point.label}: score ${point.score.toFixed(3)}, observed ${point.hitRate.toFixed(3)}`}</title>
          </circle>
        ))}
        <text x={padding} y={height - 20}>Mean score</text>
        <text className="curve-y-label" x={18} y={padding + chartHeight / 2} transform={`rotate(-90 18 ${padding + chartHeight / 2})`}>Observed hit rate</text>
        <text x={padding} y={height - bottomPadding + 22}>0.0</text>
        <text x={width - padding} y={height - bottomPadding + 22} textAnchor="end">1.0</text>
        <text x={padding - 10} y={height - bottomPadding} textAnchor="end">0.0</text>
        <text x={padding - 10} y={padding + 4} textAnchor="end">1.0</text>
      </svg>
    </section>
  );
}

function ThresholdReturnCurve({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const points = thresholdReturnPoints(version);
  if (!version || !points.length) {
    return (
      <DiagnosticLineChart
        title={version ? `Threshold Return · ${compactVersionLabel(version, 0)}` : 'Threshold Return'}
        series={selectedDiagnosticSeries(version, 'threshold_return')}
        emptyLabel={emptyLabel}
      />
    );
  }
  return (
    <NumericDiagnosticCurve
      title={`Threshold Return · ${compactVersionLabel(version, 0)}`}
      xLabel="Decision threshold"
      yLabel="Return per selected"
      points={points}
      valueLabel={(point) => point.selectedCount === null ? point.y.toFixed(4) : `${point.y.toFixed(4)} · ${point.selectedCount} selected`}
    />
  );
}

function CostSensitivityCurve({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const points = costSensitivityPoints(version);
  if (!version || !points.length) {
    return (
      <DiagnosticLineChart
        title={version ? `Cost Sensitivity · ${compactVersionLabel(version, 0)}` : 'Cost Sensitivity'}
        series={selectedDiagnosticSeries(version, 'cost_sensitivity')}
        emptyLabel={emptyLabel}
      />
    );
  }
  return (
    <NumericDiagnosticCurve
      title={`Cost Sensitivity · ${compactVersionLabel(version, 0)}`}
      xLabel="Cost multiple"
      yLabel="Net return"
      points={points}
      valueLabel={(point) => `${point.label}: ${point.y.toFixed(4)}`}
    />
  );
}

function ScoreDecileReturnCurve({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const points = scoreDecileReturnPoints(version);
  if (!version || !points.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">Score Decile Return</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  return (
    <NumericDiagnosticCurve
      title={`Score Decile Return · ${compactVersionLabel(version, 0)}`}
      xLabel="Score decile"
      yLabel="Excess return"
      points={points}
      valueLabel={(point) => `${point.label}: ${point.y.toFixed(4)}`}
    />
  );
}

function NumericDiagnosticCurve({
  title,
  xLabel,
  yLabel,
  points,
  valueLabel,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  points: Array<{ label: string; x: number; y: number; selectedCount?: number | null }>;
  valueLabel: (point: { label: string; x: number; y: number; selectedCount?: number | null }) => string;
}) {
  const width = 680;
  const height = 260;
  const padding = 42;
  const bottomPadding = 58;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const projectX = (value: number) => padding + ((value - minX) / xRange) * (width - padding * 2);
  const projectY = (value: number) => height - bottomPadding - ((value - minY) / yRange) * (height - padding - bottomPadding);
  const projected = points.map((point) => ({ ...point, xPx: projectX(point.x), yPx: projectY(point.y) }));
  const zeroY = projectY(0);
  const linePoints = projected.map((point) => `${point.xPx},${point.yPx}`).join(' ');
  const areaPoints = [
    `${projected[0].xPx},${zeroY}`,
    ...projected.map((point) => `${point.xPx},${point.yPx}`),
    `${projected[projected.length - 1].xPx},${zeroY}`,
  ].join(' ');
  const best = projected.reduce((current, point) => (point.y > current.y ? point : current), projected[0]);
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">{title}</span>
        <strong>Best {best.y.toFixed(3)}</strong>
      </div>
      <svg className="model-diagnostic-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line className="curve-axis" x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        <line className="curve-axis" x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line className="curve-zero-line" x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} />
        <polygon className="curve-area" points={areaPoints} />
        <polyline className="curve-line" points={linePoints} />
        {projected.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.xPx} cy={point.yPx} r={point === best ? 5.5 : 4}>
            <title>{valueLabel(point)}</title>
          </circle>
        ))}
        <text x={padding} y={height - 20}>{xLabel}</text>
        <text className="curve-y-label" x={18} y={padding + (height - padding - bottomPadding) / 2} transform={`rotate(-90 18 ${padding + (height - padding - bottomPadding) / 2})`}>{yLabel}</text>
        <text x={padding} y={height - bottomPadding + 22}>{points[0].label}</text>
        <text x={width - padding} y={height - bottomPadding + 22} textAnchor="end">{points[points.length - 1].label}</text>
      </svg>
    </section>
  );
}

function ModelScorecardSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="model-scorecard-section">
      <div className="model-scorecard-head">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="model-chart-grid">
        {children}
      </div>
    </section>
  );
}

function SilhouetteDiagnosticBars({
  version,
  emptyLabel,
}: {
  version: ModelGroupPromotionVersionPayload | null;
  emptyLabel: string;
}) {
  const series = uniqueSilhouettePoints(selectedDiagnosticSeries(version, 'silhouette')[0]?.points ?? []);
  if (!version || !series.length) {
    return (
      <section className="model-chart-panel">
        <div className="model-chart-title">Silhouette</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }
  const width = 680;
  const height = 190;
  const padding = 42;
  const centerX = width / 2;
  const scale = (width - padding * 2) / 2;
  const equivalentNote = equivalentSilhouetteNote(series);
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Silhouette · {compactVersionLabel(version, 0)}</span>
        <strong>-1 to +1 separation</strong>
      </div>
      <svg className="model-silhouette-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Silhouette diagnostic bars">
        <line x1={centerX} y1={padding - 12} x2={centerX} y2={height - 30} />
        {series.map((point, index) => {
          const y = padding + index * 58;
          const value = Math.max(-1, Math.min(1, point.value));
          const barWidth = Math.abs(value) * scale;
          const x = value >= 0 ? centerX : centerX - barWidth;
          return (
            <g key={point.label}>
              <text x={padding} y={y + 15}>{point.label}</text>
              <rect x={x} y={y} width={barWidth} height="22" rx="5" className={value >= 0 ? 'silhouette-positive' : 'silhouette-negative'} />
              <text x={value >= 0 ? x + barWidth + 8 : x - 8} y={y + 16} textAnchor={value >= 0 ? 'start' : 'end'}>{point.value.toFixed(3)}</text>
            </g>
          );
        })}
      </svg>
      {equivalentNote ? <div className="model-chart-note">{equivalentNote}</div> : null}
    </section>
  );
}

function SliceDistributionPanel({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const sideValues = sliceRowCountValues(version, 'decision_intended_side');
  const actionValues = sliceRowCountValues(version, 'decision_intended_action');
  const dispositionValues = sliceRowCountValues(version, 'decision_disposition');
  const confidenceValues = sliceRowCountValues(version, 'decision_confidence_band');
  const hasValues = [sideValues, actionValues, dispositionValues, confidenceValues].some((values) => Object.keys(values).length);
  const unavailableReason = diagnosticUnavailableReason(version, 'slice_distribution');
  return (
    <section className="model-chart-panel">
      <div className="model-chart-title">Slice Distribution</div>
      {hasValues ? (
        <>
          <div className="variable-coverage-grid compact">
            <CoverageBars title="Side rows" values={sideValues} />
            <CoverageBars title="Action rows" values={actionValues} />
            <CoverageBars title="Disposition rows" values={dispositionValues} />
            <CoverageBars title="Confidence rows" values={confidenceValues} />
          </div>
          <div className="model-chart-note">These are row-count slices from the scorecard; use them to spot when multiple silhouette bars are driven by the same accepted/rejected split.</div>
        </>
      ) : (
        <div className="empty-chart compact">{unavailableReason ?? 'Slice scorecard rows not published'}</div>
      )}
    </section>
  );
}

function AdaptiveDiagnosticChart({
  title,
  globalSeries,
  selectedVersion,
  selectedKind,
  emptyLabel,
}: {
  title: string;
  globalSeries: Array<{ label: string; value: number; status?: string | null }>;
  selectedVersion: ModelGroupPromotionVersionPayload | null;
  selectedKind: 'monthly_brier' | 'calibration' | 'silhouette';
  emptyLabel: string;
}) {
  if (selectedVersion) {
    if (selectedKind === 'monthly_brier') {
      return (
        <TemporalDiagnosticCurve
          title="Brier"
          version={selectedVersion}
          metricKey="brier_score"
          emptyLabel="No selected-model Brier stability curve published"
        />
      );
    }
    if (selectedKind === 'calibration') {
      return <CalibrationReliabilityChart version={selectedVersion} emptyLabel="No selected-model calibration curve published" />;
    }
    if (selectedKind === 'silhouette') {
      return <SilhouetteDiagnosticBars version={selectedVersion} emptyLabel="No selected-model silhouette diagnostics published" />;
    }
    return (
      <DiagnosticLineChart
        title={`${title} · ${compactVersionLabel(selectedVersion, 0)}`}
        series={selectedDiagnosticSeries(selectedVersion, selectedKind)}
        emptyLabel={`No selected-model curve published for ${title}`}
      />
    );
  }
  return <MiniMetricBarChart title={`${title} · Global Compare`} series={globalSeries} emptyLabel={emptyLabel} />;
}

function IdentityDistribution({ versions }: { versions: ModelGroupPromotionVersionPayload[] }) {
  const counts = identityCounts(versions);
  const identities = ['active', 'shadow', 'candidate', 'retired'];
  const total = Math.max(1, versions.length);
  return (
    <section className="model-chart-panel identity-panel">
      <div className="model-chart-title">Version Identity</div>
      <div className="identity-bars">
        {identities.map((identity) => {
          const count = counts[identity] ?? 0;
          return (
            <div className="identity-row" key={identity}>
              <span>{startCase(identity)}</span>
              <div className="identity-track"><div className={`identity-fill identity-${identity}`} style={{ width: `${(count / total) * 100}%` }} /></div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CoverageBars({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return (
    <div className="variable-coverage-block">
      <span>{title}</span>
      {entries.length ? entries.map(([label, value], index) => (
        <div className="variable-coverage-row" key={label}>
          <small>{startCase(label)}</small>
          <div><i style={{ width: `${total ? (value / total) * 100 : 0}%`, background: SCATTER_GROUP_COLORS[index % SCATTER_GROUP_COLORS.length] }} /></div>
          <strong>{value}</strong>
        </div>
      )) : <em>Not reported</em>}
    </div>
  );
}

function DecisionVariableAuditPanel({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const diagnostics = decisionVariableDiagnostics(version);
  if (!version || !diagnostics) {
    return (
      <section className="model-chart-panel decision-variable-panel">
        <div className="model-chart-title">Decision Variable Audit</div>
        <div className="empty-chart compact">Select a model with decision-variable diagnostics</div>
      </section>
    );
  }
  const status = String(diagnostics.status ?? version.metrics?.decision_variable_schema_status ?? 'not_reported');
  const rowCount = metricNumber(diagnostics, 'row_count');
  const unknownCounts = nestedRecord(diagnostics, 'unknown_counts');
  const leakageStatus = String(diagnostics.feature_namespace_leakage_status ?? 'not_reported');
  const leakageColumns = Array.isArray(diagnostics.feature_namespace_leakage_columns) ? diagnostics.feature_namespace_leakage_columns.map(String) : [];
  const samples = normalizedVariableSamples(diagnostics).slice(0, 5);
  return (
    <section className="model-chart-panel decision-variable-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Decision Variable Audit · {compactVersionLabel(version, 0)}</span>
        <div className="active-model-meta">
          <StatusPill status={status} severity={status === 'passed' ? 'low' : 'medium'} />
          <StatusPill status={`feature leakage ${leakageStatus}`} severity={leakageStatus === 'passed' ? 'low' : 'medium'} />
        </div>
      </div>
      <div className="decision-variable-stats">
        <ModelLifecycleStat label="Rows" value={formatMetricValue(rowCount, 0)} />
        <ModelLifecycleStat label="Unknown side" value={formatMetricValue(metricNumber(unknownCounts, 'decision_intended_side'), 0)} />
        <ModelLifecycleStat label="Unknown agency" value={formatMetricValue(metricNumber(unknownCounts, 'decision_agency'), 0)} />
      </div>
      <div className="variable-coverage-grid">
        <CoverageBars title="Long / short / flat" values={coverageValues(diagnostics, 'decision_intended_side')} />
        <CoverageBars title="Open / skip action" values={coverageValues(diagnostics, 'decision_intended_action')} />
        <CoverageBars title="Decision disposition" values={coverageValues(diagnostics, 'decision_disposition')} />
        <CoverageBars title="Right / wrong action" values={coverageValues(diagnostics, 'eval_action_class')} />
        <CoverageBars title="Economic result" values={coverageValues(diagnostics, 'eval_economic_class')} />
        <CoverageBars title="Execution fill" values={coverageValues(diagnostics, 'replay_fill_status')} />
      </div>
      {leakageColumns.length ? <div className="variable-leakage">Leaky feature fields: {leakageColumns.join(', ')}</div> : null}
      {samples.length ? (
        <div className="variable-sample-table">
          <div className="variable-sample-row variable-sample-head">
            <span>Side</span><span>Action</span><span>Disposition</span><span>Agency</span><span>Eval</span><span>Excess</span>
          </div>
          {samples.map((sample, index) => (
            <div className="variable-sample-row" key={`${sample.decision_id ?? index}`}>
              <span>{startCase(String(sample.decision_intended_side ?? 'unknown'))}</span>
              <span>{startCase(String(sample.decision_intended_action ?? 'unknown'))}</span>
              <span>{startCase(String(sample.decision_disposition ?? 'unknown'))}</span>
              <span>{startCase(String(sample.decision_agency ?? 'unknown'))}</span>
              <span>{startCase(String(sample.eval_action_class ?? 'unknown'))}</span>
              <span>{formatMetricValue(metricNumber(sample, 'replay_excess_return'), 4)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EvaluationDisagreementPanel({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const report = evaluationDisagreementReport(version);
  if (!version) {
    return (
      <section className="model-chart-panel disagreement-panel">
        <div className="model-chart-title">Evaluation Disagreement Report</div>
        <div className="empty-chart compact">Select a model with disagreement evidence</div>
      </section>
    );
  }
  if (!report) {
    return (
      <section className="model-chart-panel disagreement-panel">
        <div className="model-chart-title">Evaluation Disagreement Report · {compactVersionLabel(version, 0)}</div>
        <div className="empty-chart compact">Selected model was evaluated before disagreement evidence was published. Rerun model-group evaluation to populate this panel.</div>
      </section>
    );
  }
  const disagreements = nestedArray(report, 'disagreements');
  const gateBasis = nestedRecord(report, 'promotion_gate_basis');
  return (
    <section className="model-chart-panel disagreement-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Evaluation Disagreement Report · {compactVersionLabel(version, 0)}</span>
        <StatusPill status={`${metricNumber(report, 'disagreement_count') ?? disagreements.length} findings`} severity={disagreements.length ? 'medium' : 'low'} />
      </div>
      <div className="disagreement-gate-note">
        AUROC hard gate: {String(gateBasis?.auroc_is_hard_gate ?? false)}
      </div>
      {disagreements.length ? (
        <div className="disagreement-list">
          {disagreements.slice(0, 5).map((item, index) => (
            <div className="disagreement-row" key={`${item.type ?? index}`}>
              <strong>{startCase(String(item.type ?? 'finding'))}</strong>
              <span>{startCase(String(item.severity ?? 'notice'))}</span>
            </div>
          ))}
        </div>
      ) : <div className="empty-chart compact">No ranking/selection/economic disagreements detected</div>}
    </section>
  );
}

function ModelVersionTable({
  versions,
  selectedVersionId,
  onSelectVersion,
}: {
  versions: ModelGroupPromotionVersionPayload[];
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortState<'label' | 'identity' | 'auroc' | 'prAuc' | 'ece' | 'integrity' | 'decision'>>({ key: 'auroc', direction: 'desc' });
  const query = filter.trim().toLowerCase();
  const rows: ModelVersionTableRow[] = versions.map((version, index) => {
    const metrics = version.metrics ?? {};
    return {
      index,
      id: versionStableId(version, index),
      label: compactVersionLabel(version, index),
      identity: modelIdentity(version),
      auroc: metricNumber(metrics, 'auroc'),
      prAuc: metricNumber(metrics, 'pr_auc'),
      ece: metricNumber(metrics, 'ece'),
      integrity: startCase(String(metrics.data_integrity_status ?? 'not_reported')),
      decision: startCase(version.decision_status ?? version.agent_review_recommendation ?? 'not_reported'),
    };
  });
  const displayedRows = rows
    .filter((row) => !query || searchText(row.label, row.identity, row.auroc, row.prAuc, row.ece, row.integrity, row.decision).includes(query))
    .sort((left, right) => compareSortValues(left[sort.key], right[sort.key], sort.direction) || left.index - right.index);
  return (
    <section className="model-version-table-panel">
      <div className="model-version-table-toolbar">
        <div>
          <strong>Model Versions</strong>
          <span>{selectedVersionId ? 'Selected model diagnostics' : 'Global comparison'}</span>
        </div>
        {selectedVersionId ? <button type="button" onClick={() => onSelectVersion(null)}>Clear selection</button> : null}
      </div>
      <div className="dashboard-table-controls">
        <label>
          <span>Filter</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter model versions..." />
        </label>
        <small>Showing {displayedRows.length} of {versions.length}</small>
      </div>
      <div className="model-table-row model-table-head">
        <SortableHeader label="Version" column="label" sort={sort} onSort={setSort} />
        <SortableHeader label="Identity" column="identity" sort={sort} onSort={setSort} />
        <SortableHeader label="AUROC" column="auroc" sort={sort} onSort={setSort} defaultDirection="desc" />
        <SortableHeader label="PR-AUC" column="prAuc" sort={sort} onSort={setSort} defaultDirection="desc" />
        <SortableHeader label="ECE" column="ece" sort={sort} onSort={setSort} />
        <SortableHeader label="Integrity" column="integrity" sort={sort} onSort={setSort} />
        <SortableHeader label="Decision" column="decision" sort={sort} onSort={setSort} />
      </div>
      {versions.length ? (displayedRows.length ? displayedRows.map((row) => (
        <button
          className={selectedVersionId === row.id ? 'model-table-row selected' : 'model-table-row'}
          key={row.id}
          onClick={() => onSelectVersion(selectedVersionId === row.id ? null : row.id)}
          type="button"
        >
          <strong>{row.label}</strong>
          <span><StatusPill status={row.identity} severity={modelStatusSeverity(row.identity)} /></span>
          <span>{formatMetricValue(row.auroc)}</span>
          <span>{formatMetricValue(row.prAuc)}</span>
          <span>{formatMetricValue(row.ece)}</span>
          <span>{row.integrity}</span>
          <span>{row.decision}</span>
        </button>
      )) : <div className="empty-chart compact">No model versions match the current filter.</div>) : (
        <div className="empty-chart compact">No valid scoped model-group promotion evidence published yet</div>
      )}
    </section>
  );
}

function BrierDecompositionChart({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const calibration = nestedRecord(version?.metrics, 'calibration_diagnostics');
  const decomposition = nestedRecord(calibration, 'brier_decomposition');
  const series = metricBarSeries(decomposition ?? version?.metrics, [
    { key: 'reliability', label: 'Reliability' },
    { key: 'resolution', label: 'Resolution' },
    { key: 'uncertainty', label: 'Uncertainty' },
    { key: 'brier_reliability', label: 'Reliability' },
    { key: 'brier_resolution', label: 'Resolution' },
    { key: 'brier_uncertainty', label: 'Uncertainty' },
  ]);
  const compactSeries = series.filter((point, index) => series.findIndex((item) => item.label === point.label) === index);
  return <MiniMetricBarChart title={version ? `Brier Decomposition · ${compactVersionLabel(version, 0)}` : 'Brier Decomposition'} series={compactSeries} emptyLabel="Brier decomposition not published" />;
}

function DataIntegrityPanel({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const integrity = nestedRecord(version?.metrics, 'data_integrity_diagnostics');
  const series = metricBarSeries(integrity, [
    { key: 'raw_row_count', label: 'Raw rows' },
    { key: 'evaluated_row_count', label: 'Evaluated rows' },
    { key: 'validation_row_excluded_count', label: 'Excluded rows' },
    { key: 'missing_timestamp_count', label: 'Missing time' },
    { key: 'feature_timestamp_failure_count', label: 'Feature time fail' },
    { key: 'label_horizon_failure_count', label: 'Label horizon fail' },
  ]);
  return <MiniMetricBarChart title={version ? `Data Integrity Counts · ${compactVersionLabel(version, 0)}` : 'Data Integrity Counts'} series={series} emptyLabel="Integrity diagnostics not published" />;
}

function ExcludedPromotionEvidencePanel({
  exclusions,
}: {
  exclusions: Array<Record<string, unknown>>;
}) {
  if (!exclusions.length) return null;
  const reasonCounts = new Map<string, number>();
  for (const exclusion of exclusions) {
    const codes = Array.isArray(exclusion.reason_codes) ? exclusion.reason_codes : [];
    for (const code of codes) {
      const key = String(code);
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
  }
  return (
    <section className="model-chart-panel evidence-exclusion-panel">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Excluded Promotion Evidence</span>
        <strong>{exclusions.length} skipped</strong>
      </div>
      <div className="exclusion-reasons">
        {[...reasonCounts.entries()].map(([reason, count]) => (
          <span key={reason}>{startCase(reason)} · {count}</span>
        ))}
      </div>
      <div className="model-chart-note">Skipped artifacts are not target-scoped promotion evidence, so they are excluded from model-version comparison.</div>
    </section>
  );
}

function ActiveModelEvidence({
  activeVersion,
  activeRef,
}: {
  activeVersion: ModelGroupPromotionVersionPayload | null;
  activeRef: string | null;
}) {
  if (!activeVersion) {
    return (
      <section className="active-model-evidence missing">
        <div>
          <span>Active Model Evidence</span>
          <strong>No active model-group version</strong>
          <small>{activeRef ? `Runtime active ref ${activeRef} does not match a published group version.` : 'No runtime active model pointer is published.'}</small>
        </div>
        <StatusPill status="no active" severity="warning" />
      </section>
    );
  }
  const identity = modelIdentity(activeVersion);
  return (
    <section className="active-model-evidence">
      <div>
        <span>Active Model Evidence</span>
        <strong>{compactVersionLabel(activeVersion, 0)}</strong>
        <small>{activeVersion.candidate_model_ref ?? activeVersion.version_id ?? 'No active ref published'}</small>
      </div>
      <div className="active-model-meta">
        <StatusPill status={identity} severity={modelStatusSeverity(identity)} />
        <span>{startCase(activeVersion.decision_status ?? activeVersion.agent_review_recommendation ?? 'not_reported')}</span>
      </div>
    </section>
  );
}

type ReplaySeries = {
  id: string;
  label: string;
  color: string;
  points: Array<{ label: string; value: number }>;
  valueByMonth: Map<string, number>;
};

type ReplayCandle = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  absoluteOpen: number;
  absoluteHigh: number;
  absoluteLow: number;
  absoluteClose: number;
  returnValue: number;
  ohlcSource: 'return_path' | 'endpoint';
};

type ReplayReturnPathOhlc = {
  open: number;
  high: number;
  low: number;
  close: number;
};

type ReplayVersionEntry = {
  version: ModelGroupPromotionVersionPayload;
  index: number;
};

type ReplayMonthRow = {
  key: string;
  month: string;
  netReturn: number;
  cumulative: number;
  drawdown: number | null;
  rowCount: number | null;
  auroc: number | null;
  brierScore: number | null;
};

type ReplayDecisionDetailRow = {
  row_index?: number;
  decision_id?: string | null;
  timestamp?: string | null;
  target_ref?: string | null;
  instrument_type?: string | null;
  action?: string | null;
  disposition?: string | null;
  fill_status?: string | null;
  score?: number | null;
  outcome_label?: string | null;
  realized_return?: number | null;
  baseline_return?: number | null;
  cost?: number | null;
  net_return?: number | null;
  reason_codes?: string[];
  model_layer?: string | null;
  model_surface?: string | null;
  model_output_ref?: string | null;
  evidence_refs?: ReplayDecisionEvidenceRef[];
  decision_trace?: ReplayDecisionTraceStep[];
};

type ReplayDecisionTraceStep = {
  component_id?: string | null;
  component_label?: string | null;
  decision?: string | null;
  status?: string | null;
  score?: number | null;
  side?: string | null;
  action?: string | null;
  reason_codes?: string[];
  model_layer?: string | null;
  model_surface?: string | null;
  model_output_ref?: string | null;
  evidence_refs?: ReplayDecisionEvidenceRef[];
};

type ReplayDecisionEvidenceRef = {
  model_layer?: string | null;
  model_surface?: string | null;
  model_output_ref?: string | null;
  evidence_ref?: string | null;
  input_ref?: string | null;
  ref?: string | null;
  status?: string | null;
  score?: number | null;
  reason_codes?: string[];
};

type ReplayDecisionDetailPayload = {
  version_id?: string;
  version_label?: string;
  month?: string;
  total_month_rows?: number;
  returned_rows?: number;
  rows?: ReplayDecisionDetailRow[];
};

type SortDirection = 'asc' | 'desc';

type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

type ReplayVersionSummary = ReturnType<typeof replayVersionOutcomeSummary> & {
  index: number;
};

type ReplayPerformanceSummary = ReturnType<typeof replayVersionPerformanceSummary> & {
  index: number;
};

type ModelVersionTableRow = {
  index: number;
  id: string;
  label: string;
  identity: string;
  auroc: number | null;
  prAuc: number | null;
  ece: number | null;
  integrity: string;
  decision: string;
};

function toggleSort<Key extends string>(
  sort: SortState<Key>,
  key: Key,
  defaultDirection: SortDirection = 'asc',
): SortState<Key> {
  if (sort.key !== key) return { key, direction: defaultDirection };
  return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
}

function compareSortValues(left: string | number | null | undefined, right: string | number | null | undefined, direction: SortDirection): number {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  return result * multiplier;
}

function searchText(...values: unknown[]): string {
  return values.flatMap((value) => Array.isArray(value) ? value : [value]).map((value) => String(value ?? '')).join(' ').toLowerCase();
}

function SortableHeader<Key extends string>({
  label,
  column,
  sort,
  onSort,
  defaultDirection = 'asc',
}: {
  label: string;
  column: Key;
  sort: SortState<Key>;
  onSort: (sort: SortState<Key>) => void;
  defaultDirection?: SortDirection;
}) {
  return (
    <button
      className="table-sort-button"
      type="button"
      onClick={() => onSort(toggleSort(sort, column, defaultDirection))}
    >
      <span>{label}</span>
      <small>{sort.key === column ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</small>
    </button>
  );
}

function replaySeriesForVersions(
  entries: ReplayVersionEntry[],
  metricKey: string,
  mode: 'raw' | 'cumulative',
): ReplaySeries[] {
  return entries.map(({ version, index }) => {
    const raw = temporalDiagnosticPoints(version, metricKey).sort((left, right) => left.label.localeCompare(right.label));
    const points = mode === 'cumulative' ? cumulativePoints(raw) : raw;
    return {
      id: versionStableId(version, index),
      label: compactVersionLabel(version, index),
      color: SCATTER_GROUP_COLORS[index % SCATTER_GROUP_COLORS.length],
      points,
      valueByMonth: new Map(points.map((point) => [point.label, point.value])),
    };
  }).filter((series) => series.points.length);
}

function normalizedNavPoints(points: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> {
  let nav = 1;
  return points.map((point) => {
    nav *= 1 + point.value;
    return { label: point.label, value: nav };
  });
}

function replayNormalizedNavSeriesForVersions(entries: ReplayVersionEntry[]): ReplaySeries[] {
  return entries.map(({ version, index }) => {
    const raw = temporalDiagnosticPoints(version, 'net_return_total').sort((left, right) => left.label.localeCompare(right.label));
    const points = normalizedNavPoints(raw);
    return {
      id: versionStableId(version, index),
      label: compactVersionLabel(version, index),
      color: SCATTER_GROUP_COLORS[index % SCATTER_GROUP_COLORS.length],
      points,
      valueByMonth: new Map(points.map((point) => [point.label, point.value])),
    };
  }).filter((series) => series.points.length);
}

function replayAbsoluteNavBase(version: ModelGroupPromotionVersionPayload): number {
  const economicQuality = scorecardSection(version, 'economic_quality');
  const directKeys = [
    'initial_nav',
    'starting_nav',
    'start_nav',
    'replay_initial_nav',
    'initial_capital',
    'starting_capital',
    'start_capital',
    'base_nav',
    'base_capital',
  ];
  for (const key of directKeys) {
    const value = metricNumber(version.metrics, key) ?? metricNumber(economicQuality, key);
    if (value !== null && value > 0) return value;
  }
  return 1;
}

function replayCandlesForVersion(version: ModelGroupPromotionVersionPayload | null): ReplayCandle[] {
  if (!version) return [];
  let nav = 1;
  const absoluteBase = replayAbsoluteNavBase(version);
  const temporal = nestedRecord(version.metrics, 'temporal_stability_diagnostics');
  return nestedArray(temporal, 'slices')
    .map((slice) => ({
      label: String(slice.month ?? ''),
      returnValue: metricNumber(slice, 'net_return_total'),
      returnPath: replayReturnPathOhlc(slice),
    }))
    .filter((point): point is { label: string; returnValue: number; returnPath: ReplayReturnPathOhlc | null } => Boolean(point.label) && point.returnValue !== null)
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((point) => {
      const open = nav;
      const close = open * (point.returnPath?.close ?? (1 + point.returnValue));
      const high = point.returnPath ? open * point.returnPath.high : Math.max(open, close);
      const low = point.returnPath ? open * point.returnPath.low : Math.min(open, close);
      nav = close;
      return {
        label: point.label,
        open,
        close,
        high: Math.max(open, close, high),
        low: Math.min(open, close, low),
        absoluteOpen: open * absoluteBase,
        absoluteClose: close * absoluteBase,
        absoluteHigh: Math.max(open, close, high) * absoluteBase,
        absoluteLow: Math.min(open, close, low) * absoluteBase,
        returnValue: point.returnValue,
        ohlcSource: point.returnPath ? 'return_path' : 'endpoint',
      };
    });
}

function monthlyReplayReturns(version: ModelGroupPromotionVersionPayload): Array<{ label: string; value: number }> {
  return temporalDiagnosticPoints(version, 'net_return_total').sort((left, right) => left.label.localeCompare(right.label));
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Number.isFinite(variance) ? Math.sqrt(variance) : null;
}

function annualizedReturnFromNav(nav: number | null, months: number): number | null {
  if (nav === null || months <= 0 || nav <= 0) return null;
  return nav ** (12 / months) - 1;
}

function drawdownFromNavPoints(points: Array<{ label: string; value: number }>): number | null {
  if (!points.length) return null;
  let peak = 1;
  let maxDrawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.value);
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, point.value / peak - 1);
  }
  return maxDrawdown;
}

function metricFallback(version: ModelGroupPromotionVersionPayload, keys: string[]): number | null {
  const economicQuality = scorecardSection(version, 'economic_quality');
  for (const key of keys) {
    const value = metricNumber(version.metrics, key) ?? metricNumber(economicQuality, key);
    if (value !== null) return value;
  }
  return null;
}

function temporalBenchmarkReturns(version: ModelGroupPromotionVersionPayload): number[] {
  const temporal = nestedRecord(version.metrics, 'temporal_stability_diagnostics');
  const benchmarkKeys = ['benchmark_return_total', 'baseline_return_total', 'benchmark_net_return_total', 'market_return_total', 'etf_return_total', 'spy_return_total'];
  return nestedArray(temporal, 'slices')
    .sort((left, right) => String(left.month ?? '').localeCompare(String(right.month ?? '')))
    .map((slice) => {
      for (const key of benchmarkKeys) {
        const value = metricNumber(slice, key);
        if (value !== null) return value;
      }
      return null;
    })
    .filter((value): value is number => value !== null);
}

function betaAgainstBenchmark(strategyReturns: number[], benchmarkReturns: number[]): number | null {
  const count = Math.min(strategyReturns.length, benchmarkReturns.length);
  if (count < 2) return null;
  const left = strategyReturns.slice(0, count);
  const right = benchmarkReturns.slice(0, count);
  const leftMean = left.reduce((sum, value) => sum + value, 0) / count;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / count;
  const covariance = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0) / (count - 1);
  const variance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0) / (count - 1);
  return variance > 0 && Number.isFinite(covariance) ? covariance / variance : null;
}

function replayVersionPerformanceSummary(version: ModelGroupPromotionVersionPayload, index: number) {
  const returns = monthlyReplayReturns(version);
  const returnValues = returns.map((point) => point.value);
  const navPoints = normalizedNavPoints(returns);
  const nav = navPoints[navPoints.length - 1]?.value ?? null;
  const months = returns.length;
  const totalReturn = metricFallback(version, ['net_return_total', 'cost_adjusted_return_total']) ?? (nav === null ? null : nav - 1);
  const excessReturn = metricFallback(version, ['excess_return_total']);
  const maxDrawdown = metricFallback(version, ['max_drawdown']) ?? drawdownFromNavPoints(navPoints);
  const annualizedReturn = metricFallback(version, ['annualized_return', 'annualized_net_return']) ?? annualizedReturnFromNav(nav, months);
  const monthlyVolatility = sampleStandardDeviation(returnValues);
  const volatility = metricFallback(version, ['annualized_volatility', 'volatility']) ?? (monthlyVolatility === null ? null : monthlyVolatility * Math.sqrt(12));
  const downsideValues = returnValues.filter((value) => value < 0);
  const downsideDeviation = downsideValues.length
    ? Math.sqrt(downsideValues.reduce((sum, value) => sum + value ** 2, 0) / downsideValues.length) * Math.sqrt(12)
    : null;
  const sharpe = metricFallback(version, ['sharpe_ratio', 'sharpe']) ?? (annualizedReturn !== null && volatility && volatility > 0 ? annualizedReturn / volatility : null);
  const sortino = metricFallback(version, ['sortino_ratio', 'sortino']) ?? (annualizedReturn !== null && downsideDeviation && downsideDeviation > 0 ? annualizedReturn / downsideDeviation : null);
  const calmar = metricFallback(version, ['calmar_ratio', 'calmar']) ?? (annualizedReturn !== null && maxDrawdown !== null && Math.abs(maxDrawdown) > 0 ? annualizedReturn / Math.abs(maxDrawdown) : null);
  const beta = metricFallback(version, ['beta', 'market_beta', 'benchmark_beta']) ?? betaAgainstBenchmark(returnValues, temporalBenchmarkReturns(version));
  const winRate = returnValues.length ? returnValues.filter((value) => value > 0).length / returnValues.length : null;
  return {
    id: versionStableId(version, index),
    label: compactVersionLabel(version, index),
    target: String(version.target_symbol ?? '').trim().toUpperCase() || 'Not reported',
    identity: modelIdentity(version),
    nav,
    totalReturn,
    excessReturn,
    maxDrawdown,
    annualizedReturn,
    volatility,
    sharpe,
    sortino,
    calmar,
    beta,
    winRate,
    months,
  };
}

function performanceMetricSeries(entries: ReplayVersionEntry[], key: keyof ReturnType<typeof replayVersionPerformanceSummary>): Array<{ label: string; value: number; status?: string | null }> {
  const points: Array<{ label: string; value: number; status?: string | null }> = [];
  entries.forEach(({ version, index }) => {
    const row = replayVersionPerformanceSummary(version, index);
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      points.push({ label: row.label, value, status: version.decision_status });
    }
  });
  return points;
}

function replayOutcomeMetricSeries(entries: ReplayVersionEntry[], key: keyof ReturnType<typeof replayVersionOutcomeSummary>): Array<{ label: string; value: number; status?: string | null }> {
  const points: Array<{ label: string; value: number; status?: string | null }> = [];
  entries.forEach(({ version, index }) => {
    const row = replayVersionOutcomeSummary(version, index);
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      points.push({ label: row.label, value, status: version.decision_status });
    }
  });
  return points;
}

function replayReturnPathOhlc(slice: Record<string, unknown>): ReplayReturnPathOhlc | null {
  const path = nestedRecord(slice, 'net_return_path_ohlc');
  if (!path) return null;
  const open = metricNumber(path, 'open');
  const high = metricNumber(path, 'high');
  const low = metricNumber(path, 'low');
  const close = metricNumber(path, 'close');
  if (open === null || high === null || low === null || close === null) return null;
  return { open, high, low, close };
}

function replayMonths(series: ReplaySeries[]): string[] {
  return [...new Set(series.flatMap((item) => item.points.map((point) => point.label)))].sort();
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function ReplayOverlayChart({
  title,
  series,
  yLabel,
  emptyLabel,
  referenceValue = 0,
}: {
  title: string;
  series: ReplaySeries[];
  yLabel: string;
  emptyLabel: string;
  referenceValue?: number;
}) {
  const months = replayMonths(series);
  const windowSize = Math.max(months.length, 1);
  const maxStart = Math.max(0, months.length - windowSize);
  const canPan = maxStart > 0;
  const [start, setStart] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; start: number } | null>(null);
  const monthKey = months.join('|');

  useEffect(() => {
    setStart(maxStart);
    setHoverIndex(null);
    setDrag(null);
  }, [maxStart, monthKey]);

  if (!series.length || !months.length) {
    return (
      <section className="model-chart-panel replay-wide-chart">
        <div className="model-chart-title">{title}</div>
        <div className="empty-chart compact">{emptyLabel}</div>
      </section>
    );
  }

  const visibleMonths = months.slice(start, start + windowSize);
  const width = 1120;
  const height = 360;
  const padding = 54;
  const bottomPadding = 62;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;
  const visibleValues = series.flatMap((item) => visibleMonths.map((month) => item.valueByMonth.get(month)).filter((value): value is number => typeof value === 'number'));
  const minValue = Math.min(referenceValue, ...visibleValues);
  const maxValue = Math.max(referenceValue, ...visibleValues);
  const range = maxValue - minValue || 1;
  const projectX = (index: number) => padding + (visibleMonths.length === 1 ? 0.5 : index / (visibleMonths.length - 1)) * chartWidth;
  const projectY = (value: number) => height - bottomPadding - ((value - minValue) / range) * chartHeight;
  const referenceY = projectY(referenceValue);
  const hoveredMonth = hoverIndex === null ? null : visibleMonths[hoverIndex] ?? null;
  const hoverX = hoverIndex === null ? null : projectX(hoverIndex);
  const pointerIndex = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
    const x = ratio * width;
    return clampInt(((x - padding) / Math.max(chartWidth, 1)) * (visibleMonths.length - 1), 0, visibleMonths.length - 1);
  };

  return (
    <section className="model-chart-panel replay-wide-chart">
      <div className="model-chart-title-row">
        <span className="model-chart-title">{title}</span>
        <strong>{compactMonthLabel(visibleMonths[0])} to {compactMonthLabel(visibleMonths[visibleMonths.length - 1])}</strong>
      </div>
      <svg
        className={`replay-overlay-chart${canPan ? ' can-pan' : ''}${drag ? ' dragging' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
        onPointerDown={(event) => {
          setHoverIndex(pointerIndex(event.clientX, event.currentTarget));
          if (!canPan) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ x: event.clientX, start });
        }}
        onPointerMove={(event) => {
          setHoverIndex(pointerIndex(event.clientX, event.currentTarget));
          if (!drag || !canPan) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const monthDelta = ((drag.x - event.clientX) / Math.max(rect.width, 1)) * windowSize;
          setStart(clampInt(drag.start + monthDelta, 0, maxStart));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDrag(null);
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDrag(null);
        }}
        onPointerLeave={() => {
          if (!drag) setHoverIndex(null);
        }}
      >
        <line className="curve-axis" x1={padding} y1={padding} x2={padding} y2={height - bottomPadding} />
        <line className="curve-axis" x1={padding} y1={height - bottomPadding} x2={width - padding} y2={height - bottomPadding} />
        <line className="curve-zero-line" x1={padding} y1={referenceY} x2={width - padding} y2={referenceY} />
        {series.map((item) => {
          const points = visibleMonths
            .map((month, index) => {
              const value = item.valueByMonth.get(month);
              return typeof value === 'number' ? `${projectX(index)},${projectY(value)}` : null;
            })
            .filter(Boolean)
            .join(' ');
          return points ? <polyline key={item.id} className="replay-overlay-line" points={points} style={{ stroke: item.color }} /> : null;
        })}
        {series.map((item) => visibleMonths.map((month, index) => {
          const value = item.valueByMonth.get(month);
          if (typeof value !== 'number') return null;
          return <circle key={`${item.id}-${month}`} cx={projectX(index)} cy={projectY(value)} r={hoverIndex === index ? 4.8 : 3.4} style={{ fill: item.color }} />;
        }))}
        {hoveredMonth && hoverX !== null ? (
          <g className="replay-hover-layer">
            <line x1={hoverX} y1={padding} x2={hoverX} y2={height - bottomPadding} />
            <rect x={Math.min(hoverX + 12, width - 250)} y={padding + 6} width="238" height={32 + series.length * 22} rx="12" />
            <text x={Math.min(hoverX + 26, width - 236)} y={padding + 28}>{hoveredMonth}</text>
            {series.map((item, index) => {
              const value = item.valueByMonth.get(hoveredMonth);
              return (
                <text key={item.id} x={Math.min(hoverX + 26, width - 236)} y={padding + 52 + index * 22} style={{ fill: item.color }}>
                  {item.label}: {typeof value === 'number' ? formatMetricValue(value, 4) : 'missing'}
                </text>
              );
            })}
          </g>
        ) : null}
        {visibleMonths.map((month, index) => {
          const showLabel = visibleMonths.length <= 8 || index === 0 || index === visibleMonths.length - 1 || index % Math.ceil(visibleMonths.length / 6) === 0;
          return showLabel ? <text key={month} x={projectX(index)} y={height - 24} textAnchor="middle">{compactMonthLabel(month)}</text> : null;
        })}
        <text className="curve-y-label" x={20} y={padding + chartHeight / 2} transform={`rotate(-90 20 ${padding + chartHeight / 2})`}>{yLabel}</text>
      </svg>
      <div className="replay-chart-footer">
        <span>All frame visible</span>
        <span>{months.length} monthly slices</span>
      </div>
    </section>
  );
}

function replayVersionOutcomeSummary(version: ModelGroupPromotionVersionPayload, index: number) {
  const metrics = version.metrics ?? {};
  const economicQuality = scorecardSection(version, 'economic_quality');
  const diagnostics = decisionVariableDiagnostics(version);
  const disposition = coverageValues(diagnostics, 'decision_disposition');
  const fillStatus = coverageValues(diagnostics, 'replay_fill_status');
  const actionClass = coverageValues(diagnostics, 'eval_action_class');
  const accepted = disposition.accepted ?? metricNumber(nestedRecord(modelScorecards(version), 'selection_quality'), 'accepted_count') ?? 0;
  const filled = fillStatus.filled ?? metricNumber(metrics, 'turnover_proxy_count') ?? 0;
  const notFilled = fillStatus.not_filled ?? 0;
  return {
    id: versionStableId(version, index),
    label: compactVersionLabel(version, index),
    identity: modelIdentity(version),
    netReturn: metricNumber(metrics, 'net_return_total') ?? metricNumber(economicQuality, 'net_return_total') ?? metricNumber(economicQuality, 'cost_adjusted_return_total'),
    excessReturn: metricNumber(metrics, 'excess_return_total') ?? metricNumber(economicQuality, 'excess_return_total'),
    maxDrawdown: metricNumber(metrics, 'max_drawdown') ?? metricNumber(economicQuality, 'max_drawdown'),
    decisionRows: metricNumber(metrics, 'decision_row_count'),
    months: temporalDiagnosticPoints(version, 'net_return_total').length,
    accepted,
    filled,
    fillDenominator: filled + notFilled,
    takenGood: actionClass.taken_good ?? 0,
    takenBad: actionClass.taken_bad ?? 0,
    avoidedBad: actionClass.avoided_bad ?? 0,
    missedGood: actionClass.missed_good ?? 0,
  };
}

function ReplayDecisionVersionSelector({
  versions,
  selectedIds,
  onChange,
  onOpenMonthly,
}: {
  versions: ModelGroupPromotionVersionPayload[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onOpenMonthly: (id: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortState<'label' | 'identity' | 'netReturn' | 'excessReturn' | 'maxDrawdown' | 'decisionRows' | 'accepted' | 'filled' | 'takenGood' | 'avoidedBad' | 'missedGood'>>({ key: 'netReturn', direction: 'desc' });
  if (!versions.length) return null;
  const query = filter.trim().toLowerCase();
  const rows: ReplayVersionSummary[] = versions
    .map((version, index) => ({ ...replayVersionOutcomeSummary(version, index), index }))
    .filter((row) => !query || searchText(row.label, row.identity, row.netReturn, row.excessReturn, row.maxDrawdown, row.decisionRows, row.accepted, row.filled, row.takenGood, row.takenBad, row.avoidedBad, row.missedGood).includes(query))
    .sort((left, right) => compareSortValues(left[sort.key], right[sort.key], sort.direction) || left.index - right.index);
  return (
    <section className="panel replay-table-panel">
      <div className="panel-heading">Replay Decision Version Selector</div>
      <div className="dashboard-table-controls">
        <label>
          <span>Filter</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter versions..." />
        </label>
        <small>Showing {rows.length} of {versions.length}</small>
      </div>
      <div className="replay-table replay-summary-table">
        <div className="replay-table-row replay-table-head">
          <SortableHeader label="Version" column="label" sort={sort} onSort={setSort} />
          <SortableHeader label="Role" column="identity" sort={sort} onSort={setSort} />
          <SortableHeader label="Performance" column="netReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Excess" column="excessReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Max DD" column="maxDrawdown" sort={sort} onSort={setSort} />
          <SortableHeader label="Rows" column="decisionRows" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Accepted" column="accepted" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Filled" column="filled" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Good / Bad" column="takenGood" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Avoided" column="avoidedBad" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Missed" column="missedGood" sort={sort} onSort={setSort} defaultDirection="desc" />
          <span>Action</span>
        </div>
        {rows.length ? rows.map((row) => {
          const selected = selectedIds.includes(row.id);
          const toggleSelected = () => {
            const next = selected ? selectedIds.filter((item) => item !== row.id) : [...selectedIds, row.id];
            onChange(next);
          };
          return (
            <div
              className={selected ? 'replay-table-row selected' : 'replay-table-row'}
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={toggleSelected}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleSelected();
                }
              }}
            >
              <strong>
                <i style={{ background: SCATTER_GROUP_COLORS[row.index % SCATTER_GROUP_COLORS.length] }} />{row.label}
              </strong>
              <span><StatusPill status={row.identity} severity={modelStatusSeverity(row.identity)} /></span>
              <span>{formatMetricValue(row.netReturn, 4)}</span>
              <span>{formatMetricValue(row.excessReturn, 4)}</span>
              <span>{formatMetricValue(row.maxDrawdown, 4)}</span>
              <span>{row.decisionRows === null ? 'Not reported' : row.decisionRows.toFixed(0)}</span>
              <span>{row.accepted.toFixed(0)}</span>
              <span>{row.fillDenominator ? `${row.filled.toFixed(0)}/${row.fillDenominator.toFixed(0)}` : row.filled.toFixed(0)}</span>
              <span>{row.takenGood.toFixed(0)} / {row.takenBad.toFixed(0)}</span>
              <span>{row.avoidedBad.toFixed(0)}</span>
              <span>{row.missedGood.toFixed(0)}</span>
              <button
                className="replay-inline-action"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenMonthly(row.id);
                }}
              >
                Focus
              </button>
            </div>
          );
        }) : <div className="empty-chart compact">No replay versions match the current filter.</div>}
      </div>
    </section>
  );
}

function ReplayPerformanceSummaryTable({
  entries,
  selectedIds,
  onChange,
}: {
  entries: ReplayVersionEntry[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortState<'label' | 'target' | 'nav' | 'totalReturn' | 'excessReturn' | 'maxDrawdown' | 'annualizedReturn' | 'volatility' | 'sharpe' | 'sortino' | 'calmar' | 'beta' | 'winRate'>>({ key: 'totalReturn', direction: 'desc' });
  const query = filter.trim().toLowerCase();
  const rows: ReplayPerformanceSummary[] = entries
    .map(({ version, index }) => ({ ...replayVersionPerformanceSummary(version, index), index }))
    .filter((row) => !query || searchText(row.label, row.target, row.identity, row.nav, row.totalReturn, row.excessReturn, row.maxDrawdown, row.annualizedReturn, row.volatility, row.sharpe, row.sortino, row.calmar, row.beta, row.winRate).includes(query))
    .sort((left, right) => compareSortValues(left[sort.key], right[sort.key], sort.direction) || left.index - right.index);
  return (
    <section className="panel replay-table-panel">
      <div className="panel-heading">Performance Summary</div>
      <div className="dashboard-table-controls">
        <label>
          <span>Filter target/model</span>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="AAPL, SPY, active…" />
        </label>
        <small>Showing {rows.length} of {entries.length}</small>
      </div>
      <div className="replay-table replay-performance-summary-table">
        <div className="replay-table-row replay-table-head">
          <SortableHeader label="Series" column="label" sort={sort} onSort={setSort} />
          <SortableHeader label="Target" column="target" sort={sort} onSort={setSort} />
          <SortableHeader label="NAV" column="nav" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Total" column="totalReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Excess" column="excessReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Max DD" column="maxDrawdown" sort={sort} onSort={setSort} />
          <SortableHeader label="Ann Ret" column="annualizedReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Vol" column="volatility" sort={sort} onSort={setSort} />
          <SortableHeader label="Sharpe" column="sharpe" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Sortino" column="sortino" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Calmar" column="calmar" sort={sort} onSort={setSort} defaultDirection="desc" />
          <SortableHeader label="Beta" column="beta" sort={sort} onSort={setSort} />
          <SortableHeader label="Win" column="winRate" sort={sort} onSort={setSort} defaultDirection="desc" />
        </div>
        {rows.length ? rows.map((row) => {
          const selected = selectedIds.includes(row.id);
          return (
            <button
              className={selected ? 'replay-table-row selected' : 'replay-table-row'}
              key={row.id}
              type="button"
              onClick={() => {
                const next = selected ? selectedIds.filter((item) => item !== row.id) : [...selectedIds, row.id];
                onChange(next);
              }}
            >
              <strong><i style={{ background: SCATTER_GROUP_COLORS[row.index % SCATTER_GROUP_COLORS.length] }} />{row.label}</strong>
              <span>{row.target}</span>
              <span>{formatMetricValue(row.nav, 4)}</span>
              <span>{formatMetricValue(row.totalReturn, 4)}</span>
              <span>{formatMetricValue(row.excessReturn, 4)}</span>
              <span>{formatMetricValue(row.maxDrawdown, 4)}</span>
              <span>{formatMetricValue(row.annualizedReturn, 4)}</span>
              <span>{formatMetricValue(row.volatility, 4)}</span>
              <span>{formatMetricValue(row.sharpe, 3)}</span>
              <span>{formatMetricValue(row.sortino, 3)}</span>
              <span>{formatMetricValue(row.calmar, 3)}</span>
              <span>{formatMetricValue(row.beta, 3)}</span>
              <span>{formatMetricValue(row.winRate, 3)}</span>
            </button>
          );
        }) : <div className="empty-chart compact">No replay performance series published.</div>}
      </div>
    </section>
  );
}

function ReplayNormalizedNavCandles({
  version,
}: {
  version: ModelGroupPromotionVersionPayload | null;
}) {
  const candles = useMemo(() => replayCandlesForVersion(version), [version]);
  const chartData = useMemo(() => candles.map(toReplayLightweightCandle), [candles]);
  const candleByTime = useMemo(() => new Map(chartData.map((candle) => [chartTimeKey(candle.time), candle])), [chartData]);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<ReplayLightweightCandle | null>(null);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !version || !chartData.length) return undefined;

    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1720' },
        textColor: '#8b9bb0',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, .10)' },
        horzLines: { color: 'rgba(148, 163, 184, .14)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(209, 213, 219, .48)',
          style: LineStyle.LargeDashed,
          labelVisible: false,
        },
        horzLine: {
          color: 'rgba(209, 213, 219, .48)',
          style: LineStyle.LargeDashed,
          labelVisible: true,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, .18)',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, .18)',
        timeVisible: false,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => price.toFixed(4),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22ab94',
      downColor: '#f23645',
      borderUpColor: '#22ab94',
      borderDownColor: '#f23645',
      wickUpColor: '#22ab94',
      wickDownColor: '#f23645',
      priceLineVisible: true,
      priceLineColor: chartData[chartData.length - 1].close >= 1 ? '#22ab94' : '#f23645',
      priceLineStyle: LineStyle.LargeDashed,
      lastValueVisible: true,
    });
    seriesRef.current = series;

    series.setData(chartData);
    series.createPriceLine({
      price: 1,
      color: 'rgba(203, 213, 225, .42)',
      lineWidth: 1,
      lineStyle: LineStyle.LargeDashed,
      axisLabelVisible: true,
      title: 'Start',
    });
    chart.timeScale().fitContent();

    const handleCrosshairMove = (event: MouseEventParams) => {
      const item = seriesRef.current ? event.seriesData.get(seriesRef.current) : null;
      const timeMatch = event.time === undefined ? null : candleByTime.get(chartTimeKey(event.time));
      setHoveredCandle(timeMatch ?? (isReplayLightweightCandle(item) ? item : null));
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      seriesRef.current = null;
      chart.remove();
    };
  }, [candleByTime, chartData, version]);

  if (!version || !candles.length) {
    return (
      <section className="model-chart-panel replay-wide-chart">
        <div className="model-chart-title">Normalized NAV K-line</div>
        <div className="empty-chart compact">Select a replay version with monthly return slices.</div>
      </section>
    );
  }
  const final = candles[candles.length - 1];
  const legendCandle = hoveredCandle ?? toReplayLightweightCandle(final);
  return (
    <section className="model-chart-panel replay-wide-chart">
      <div className="model-chart-title-row">
        <span className="model-chart-title">Normalized NAV K-line · {compactVersionLabel(version, 0)}</span>
        <strong>{final.label} · {formatMetricValue(final.close, 4)}</strong>
      </div>
      <div className="replay-lightweight-chart-shell">
        <div className="replay-lightweight-legend">
          <strong>{legendCandle.label}</strong>
          <span>Abs O {formatMetricValue(legendCandle.absoluteOpen, 2)} H {formatMetricValue(legendCandle.absoluteHigh, 2)} L {formatMetricValue(legendCandle.absoluteLow, 2)} C {formatMetricValue(legendCandle.absoluteClose, 2)}</span>
          <span>Norm O {legendCandle.open.toFixed(4)} H {legendCandle.high.toFixed(4)} L {legendCandle.low.toFixed(4)} C {legendCandle.close.toFixed(4)}</span>
          <span className={legendCandle.close >= legendCandle.open ? 'positive' : 'negative'}>R {legendCandle.returnValue.toFixed(4)}</span>
          <span>{legendCandle.ohlcSource === 'return_path' ? 'Path OHLC' : 'Endpoint OHLC'}</span>
        </div>
        <div ref={chartRef} className="replay-lightweight-chart" role="img" aria-label="Replay normalized NAV K-line" />
      </div>
    </section>
  );
}

function ReplayPerformanceNavChart({ entries }: { entries: ReplayVersionEntry[] }) {
  if (entries.length === 1) {
    return <ReplayNormalizedNavCandles version={entries[0]?.version ?? null} />;
  }
  return (
    <ReplayOverlayChart
      title="Normalized NAV"
      series={replayNormalizedNavSeriesForVersions(entries)}
      yLabel="Normalized NAV"
      emptyLabel="No replay NAV slices published"
      referenceValue={1}
    />
  );
}

function ReplaySelectionModePanel({
  mode,
  summary,
  onClear,
}: {
  mode: 'summary' | 'focus';
  summary: string;
  onClear?: () => void;
}) {
  return (
    <section className={`selection-mode-panel ${mode}`}>
      <div>
        <span>{mode === 'summary' ? 'Summary View' : 'Focus View'}</span>
        <strong>{summary}</strong>
      </div>
      {mode === 'focus' && onClear ? <button type="button" onClick={onClear}>Clear selection</button> : null}
    </section>
  );
}

function replayReviewRuns(chart: ReplayReviewChartPayload): Array<Record<string, unknown>> {
  return Array.isArray(chart.review_runs)
    ? chart.review_runs.filter((run): run is Record<string, unknown> => Boolean(run) && typeof run === 'object' && !Array.isArray(run))
    : [];
}

function replayEventRuns(chart: ReplayReviewChartPayload): Array<Record<string, unknown>> {
  return Array.isArray(chart.event_runs)
    ? chart.event_runs.filter((run): run is Record<string, unknown> => Boolean(run) && typeof run === 'object' && !Array.isArray(run))
    : [];
}

function replayReviewRunId(run: Record<string, unknown>, index: number): string {
  return String(run.review_run_id ?? run.candidate_model_ref ?? run.replay_execution_run_id ?? index);
}

function replayReviewRunLabel(run: Record<string, unknown>, index: number): string {
  const target = String(run.target_symbol ?? run.candidate_training_target ?? '').trim().toUpperCase();
  const fold = String(run.candidate_fold_id ?? '').replace(/^fold_/u, '').replace('_', ' to ');
  if (target && fold) return `${target} ${fold}`;
  if (target) return target;
  if (fold) return fold;
  return String(run.review_run_id ?? `Review ${index + 1}`);
}

function replayReviewSection(run: Record<string, unknown>, section: string): Record<string, unknown> | null {
  return nestedRecord(nestedRecord(run, 'performance'), section);
}

function replayReviewDecision(run: Record<string, unknown>): Record<string, unknown> | null {
  return nestedRecord(run, 'decision_review');
}

function replayReviewParameter(run: Record<string, unknown>): Record<string, unknown> | null {
  return nestedRecord(run, 'parameter_review');
}

function countRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> {
  return nestedRecord(record, key) ?? {};
}

function countSeriesFromRecord(counts: Record<string, unknown>): Array<{ label: string; value: number }> {
  return Object.entries(counts)
    .map(([label, value]) => ({ label: startCase(label), value: typeof value === 'number' ? value : Number(value) }))
    .filter((point) => Number.isFinite(point.value))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function aggregateCounts(runs: Array<Record<string, unknown>>, section: (run: Record<string, unknown>) => Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    for (const [key, value] of Object.entries(section(run))) {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numeric)) counts[key] = (counts[key] ?? 0) + numeric;
    }
  }
  return counts;
}

function replayReviewMetricSeries(
  runs: Array<Record<string, unknown>>,
  metric: (run: Record<string, unknown>) => number | null,
): Array<{ label: string; value: number; status?: string | null }> {
  return runs
    .map((run, index) => {
      const value = metric(run);
      return value === null ? null : { label: replayReviewRunLabel(run, index), value };
    })
    .filter((point): point is { label: string; value: number } => Boolean(point));
}

function countChips(counts: Record<string, unknown>, emptyLabel: string) {
  const entries = countSeriesFromRecord(counts).slice(0, 6);
  return entries.length ? (
    <div className="chips">
      {entries.map((entry) => <span className="chip" key={entry.label}>{entry.label}: {entry.value}</span>)}
    </div>
  ) : <span className="muted">{emptyLabel}</span>;
}

function ReplayReviewRunSelector({
  title,
  runs,
  selectedIds,
  onChange,
  onFocus,
}: {
  title: string;
  runs: Array<Record<string, unknown>>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onFocus?: (id: string) => void;
}) {
  if (!runs.length) {
    return (
      <section className="panel replay-table-panel">
        <div className="panel-heading">{title}</div>
        <div className="empty-chart compact">No replay review runs are published in the current read model.</div>
      </section>
    );
  }
  return (
    <section className="panel replay-table-panel">
      <div className="panel-heading">{title}</div>
      <div className="replay-table replay-review-summary-table">
        <div className="replay-table-row replay-table-head">
          <span>Model Group</span>
          <span>Rows</span>
          <span>Filled</span>
          <span>PnL</span>
          <span>Mean Return</span>
          <span>Best Regret</span>
          <span>Events</span>
          <span>Action</span>
        </div>
        {runs.map((run, index) => {
          const id = replayReviewRunId(run, index);
          const selected = selectedIds.includes(id);
          const decisionScope = replayReviewSection(run, 'decision_scope');
          const performance = replayReviewSection(run, 'target_performance');
          const decision = replayReviewDecision(run);
          const toggleSelected = () => {
            onChange(selected ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
          };
          return (
            <div
              className={selected ? 'replay-table-row selected' : 'replay-table-row'}
              key={id}
              role="button"
              tabIndex={0}
              onClick={toggleSelected}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleSelected();
                }
              }}
            >
              <strong><i style={{ background: SCATTER_GROUP_COLORS[index % SCATTER_GROUP_COLORS.length] }} />{replayReviewRunLabel(run, index)}</strong>
              <span>{formatMetricValue(metricNumber(decisionScope, 'decision_row_count'), 0)}</span>
              <span>{formatMetricValue(metricNumber(decisionScope, 'filled_count'), 0)}</span>
              <span>{formatMetricValue(metricNumber(performance, 'gross_pnl_total'), 2)}</span>
              <span>{formatMetricValue(metricNumber(performance, 'mean_realized_return'), 4)}</span>
              <span>{formatMetricValue(metricNumber(decision, 'mean_regret_to_best_available'), 4)}</span>
              <span>{formatMetricValue(metricNumber(run, 'event_candidate_count'), 0)}</span>
              {onFocus ? (
                <button
                  className="replay-inline-action"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFocus(id);
                  }}
                >
                  Focus
                </button>
              ) : <span />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReplayReviewFocusPanel({
  runs,
  title,
}: {
  runs: Array<Record<string, unknown>>;
  title: string;
}) {
  if (!runs.length) return null;
  return (
    <section className="panel replay-review-focus-panel">
      <div className="panel-heading">{title}</div>
      <div className="replay-review-focus-grid">
        {runs.map((run, index) => {
          const decision = replayReviewDecision(run);
          const parameter = replayReviewParameter(run);
          const sourceRefs = nestedRecord(run, 'source_refs');
          return (
            <div className="replay-review-focus-card" key={replayReviewRunId(run, index)}>
              <strong>{replayReviewRunLabel(run, index)}</strong>
              <span>Cause family</span>
              {countChips(countRecord(decision, 'cause_family_counts'), 'No cause-family counts')}
              <span>Layer attribution</span>
              {countChips(countRecord(decision, 'miss_attribution_layer_counts'), 'No layer attribution counts')}
              <span>Parameter classes</span>
              {countChips(countRecord(parameter, 'classification_counts'), 'No parameter replay review')}
              <small>{String(sourceRefs?.review_rows_ref ?? sourceRefs?.receipt_ref ?? 'No source ref published')}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReplayReviewPageContract({
  chart,
  pageId,
}: {
  chart: ReplayReviewChartPayload;
  pageId: string;
}) {
  const contract = (chart.page_contracts ?? []).find((item) => item.page_id === pageId);
  if (!contract) return null;
  return (
    <section className="panel replay-page-contract-panel">
      <div className="panel-heading">{startCase(pageId)} Scope</div>
      <p className="panel-subtitle">{String(contract.question ?? '')}</p>
      <div className="metric-grid three">
        <MetricCard label="Primary source" value={String(contract.primary_source ?? 'Not reported')} />
        <MetricCard label="Primary grain" value={String(contract.primary_grain ?? 'Not reported')} />
        <MetricCard label="Caution" value={String(contract.caution ?? 'No special caution')} />
      </div>
    </section>
  );
}

type ReplayLightweightCandle = CandlestickData & {
  label: string;
  absoluteOpen: number;
  absoluteHigh: number;
  absoluteLow: number;
  absoluteClose: number;
  returnValue: number;
  ohlcSource: ReplayCandle['ohlcSource'];
};

function toReplayLightweightCandle(candle: ReplayCandle): ReplayLightweightCandle {
  return {
    time: replayMonthToChartTime(candle.label),
    label: candle.label,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    absoluteOpen: candle.absoluteOpen,
    absoluteHigh: candle.absoluteHigh,
    absoluteLow: candle.absoluteLow,
    absoluteClose: candle.absoluteClose,
    returnValue: candle.returnValue,
    ohlcSource: candle.ohlcSource,
  };
}

function replayMonthToChartTime(label: string): string {
  return /^\d{4}-\d{2}$/.test(label) ? `${label}-01` : label;
}

function chartTimeKey(time: CandlestickData['time']): string {
  if (typeof time === 'string' || typeof time === 'number') return String(time);
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

function isReplayLightweightCandle(value: unknown): value is ReplayLightweightCandle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplayLightweightCandle>;
  return typeof candidate.label === 'string'
    && typeof candidate.open === 'number'
    && typeof candidate.high === 'number'
    && typeof candidate.low === 'number'
    && typeof candidate.close === 'number'
    && typeof candidate.absoluteOpen === 'number'
    && typeof candidate.absoluteHigh === 'number'
    && typeof candidate.absoluteLow === 'number'
    && typeof candidate.absoluteClose === 'number'
    && typeof candidate.returnValue === 'number'
    && (candidate.ohlcSource === 'return_path' || candidate.ohlcSource === 'endpoint');
}

function replayMonthlyRows(version: ModelGroupPromotionVersionPayload, index: number): ReplayMonthRow[] {
  let cumulative = 0;
  const temporal = nestedRecord(version.metrics, 'temporal_stability_diagnostics');
  return nestedArray(temporal, 'slices')
    .map((slice) => ({
      month: String(slice.month ?? ''),
      netReturn: metricNumber(slice, 'net_return_total'),
      drawdown: metricNumber(slice, 'max_drawdown'),
      rowCount: metricNumber(slice, 'row_count'),
      auroc: metricNumber(slice, 'auroc'),
      brierScore: metricNumber(slice, 'brier_score'),
    }))
    .filter((row): row is Omit<ReplayMonthRow, 'key' | 'cumulative'> => Boolean(row.month) && row.netReturn !== null)
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((row) => {
      cumulative += row.netReturn;
      return {
        key: `${versionStableId(version, index)}-${row.month}`,
        ...row,
        cumulative,
      };
    });
}

function replayDecisionTraceLabel(step: ReplayDecisionTraceStep): string {
  const label = step.component_label ?? step.component_id ?? 'Component';
  const decision = step.decision ?? step.action ?? step.status ?? 'reported';
  const score = typeof step.score === 'number' && Number.isFinite(step.score) ? ` ${step.score.toFixed(3)}` : '';
  return `${label}: ${startCase(decision)}${score}`;
}

function replayDecisionEvidenceRefLabel(ref: ReplayDecisionEvidenceRef): string {
  const source = [ref.model_layer, ref.model_surface].filter(Boolean).join(' / ');
  const identity = ref.model_output_ref ?? ref.evidence_ref ?? ref.input_ref ?? ref.ref ?? '';
  const score = typeof ref.score === 'number' && Number.isFinite(ref.score) ? ` score ${ref.score.toFixed(3)}` : '';
  const status = ref.status ? ` ${startCase(ref.status)}` : '';
  const reasons = ref.reason_codes?.length ? ` ${ref.reason_codes.map(startCase).join(', ')}` : '';
  return [source, identity].filter(Boolean).join(' -> ') + status + score + reasons;
}

function replayDecisionStepEvidenceLabels(step: ReplayDecisionTraceStep): string[] {
  const direct = [step.model_layer, step.model_surface, step.model_output_ref].filter(Boolean).join(' -> ');
  return [direct, ...(step.evidence_refs ?? []).map(replayDecisionEvidenceRefLabel)]
    .map((label) => label.trim())
    .filter(Boolean);
}

function replayDecisionRowEvidenceLabels(row: ReplayDecisionDetailRow): string[] {
  const direct = [row.model_layer, row.model_surface, row.model_output_ref].filter(Boolean).join(' -> ');
  const labels = [
    direct,
    ...(row.evidence_refs ?? []).map(replayDecisionEvidenceRefLabel),
    ...(row.decision_trace ?? []).flatMap(replayDecisionStepEvidenceLabels),
  ].map((label) => label.trim()).filter(Boolean);
  return [...new Set(labels)];
}

function ReplayComponentDecisionSummary({ rows }: { rows: ReplayDecisionDetailRow[] }) {
  const counts = new Map<string, { label: string; count: number; decisions: Map<string, number> }>();
  for (const row of rows) {
    for (const step of row.decision_trace ?? []) {
      const key = String(step.component_id ?? step.component_label ?? 'unknown_component');
      const label = step.component_label ?? startCase(key);
      const decision = startCase(step.decision ?? step.action ?? step.status ?? 'reported');
      const existing = counts.get(key) ?? { label, count: 0, decisions: new Map<string, number>() };
      existing.count += 1;
      existing.decisions.set(decision, (existing.decisions.get(decision) ?? 0) + 1);
      counts.set(key, existing);
    }
  }
  const entries = [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  if (!entries.length) return null;
  return (
    <section className="replay-component-summary">
      <div className="model-chart-title">Component Decision Summary</div>
      <div className="replay-component-grid">
        {entries.map((entry) => {
          const topDecisions = [...entry.decisions.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 3);
          return (
            <div className="replay-component-card" key={entry.key}>
              <strong>{entry.label}</strong>
              <span>{entry.count} row decisions</span>
              <small>{topDecisions.map(([decision, count]) => `${decision} ${count}`).join(' · ')}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReplayDecisionEvidenceSummary({ rows }: { rows: ReplayDecisionDetailRow[] }) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const label of replayDecisionRowEvidenceLabels(row)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const entries = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6);
  if (!entries.length) return null;
  return (
    <section className="replay-component-summary">
      <div className="model-chart-title">Model Evidence Pivot</div>
      <div className="replay-evidence-grid">
        {entries.map(([label, count]) => (
          <div className="replay-evidence-card" key={label}>
            <strong>{label}</strong>
            <span>{count} linked decisions</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReplayDecisionDetailTable({
  versionId,
  month,
  activeRow,
}: {
  versionId: string;
  month: string | null;
  activeRow: ReplayMonthRow | null;
}) {
  const [payload, setPayload] = useState<ReplayDecisionDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortState<'timestamp' | 'decision_id' | 'target_ref' | 'instrument_type' | 'action' | 'disposition' | 'fill_status' | 'score' | 'net_return' | 'realized_return' | 'cost' | 'reason_codes' | 'evidence_refs' | 'decision_trace'>>({ key: 'timestamp', direction: 'asc' });
  useEffect(() => {
    if (!month) {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/replay-decisions?version=${encodeURIComponent(versionId)}&month=${encodeURIComponent(month)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as (ReplayDecisionDetailPayload & { error?: string }) | null;
        if (!response.ok) throw new Error(body?.error ?? 'Replay decision rows unavailable');
        setPayload(body);
      })
      .catch((caught: unknown) => {
        if ((caught as { name?: string })?.name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Replay decision rows unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [versionId, month]);
  const rows = payload?.rows ?? [];
  const query = filter.trim().toLowerCase();
  const displayedRows = rows
    .filter((row) => !query || searchText(row.timestamp, row.decision_id, row.target_ref, row.instrument_type, row.action, row.disposition, row.fill_status, row.score, row.net_return, row.realized_return, row.cost, row.reason_codes, replayDecisionRowEvidenceLabels(row), row.decision_trace?.map(replayDecisionTraceLabel)).includes(query))
    .sort((left, right) => {
      const sortValue = (row: ReplayDecisionDetailRow): string | number | null | undefined => {
        if (sort.key === 'reason_codes') return (row.reason_codes ?? []).join(', ');
        if (sort.key === 'evidence_refs') return replayDecisionRowEvidenceLabels(row).join(', ');
        if (sort.key === 'decision_trace') return (row.decision_trace ?? []).map(replayDecisionTraceLabel).join(', ');
        return row[sort.key];
      };
      return compareSortValues(sortValue(left), sortValue(right), sort.direction);
    });
  return (
    <section className="replay-trade-detail-panel">
      <div className="panel-heading">Replay Decision Details · {month ?? 'No month'}</div>
      {activeRow ? (
        <div className="replay-detail-kpis">
          <span>Net {formatMetricValue(activeRow.netReturn, 4)}</span>
          <span>Rows {activeRow.rowCount === null ? 'Not reported' : activeRow.rowCount.toFixed(0)}</span>
          <span>Drawdown {formatMetricValue(activeRow.drawdown, 4)}</span>
          {payload ? <span>Loaded {payload.returned_rows ?? rows.length}/{payload.total_month_rows ?? rows.length}</span> : null}
        </div>
      ) : null}
      {loading ? <div className="empty-chart compact">Loading replay decision rows</div> : null}
      {error ? <div className="empty-chart compact">{error}</div> : null}
      {!loading && !error && rows.length ? (
        <>
        <ReplayComponentDecisionSummary rows={rows} />
        <ReplayDecisionEvidenceSummary rows={rows} />
        <div className="dashboard-table-controls">
          <label>
            <span>Filter</span>
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter decisions, components, or model refs..." />
          </label>
          <small>Showing {displayedRows.length} of {rows.length}</small>
        </div>
        <div className="replay-decision-table-wrap">
          <div className="replay-table replay-decision-table">
            <div className="replay-table-row replay-table-head">
              <SortableHeader label="Time" column="timestamp" sort={sort} onSort={setSort} />
              <SortableHeader label="Decision" column="decision_id" sort={sort} onSort={setSort} />
              <SortableHeader label="Target" column="target_ref" sort={sort} onSort={setSort} />
              <SortableHeader label="Type" column="instrument_type" sort={sort} onSort={setSort} />
              <SortableHeader label="Action" column="action" sort={sort} onSort={setSort} />
              <SortableHeader label="Disposition" column="disposition" sort={sort} onSort={setSort} />
              <SortableHeader label="Fill" column="fill_status" sort={sort} onSort={setSort} />
              <SortableHeader label="Score" column="score" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Net" column="net_return" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Realized" column="realized_return" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Cost" column="cost" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Reasons" column="reason_codes" sort={sort} onSort={setSort} />
              <SortableHeader label="Evidence" column="evidence_refs" sort={sort} onSort={setSort} />
              <SortableHeader label="Trace" column="decision_trace" sort={sort} onSort={setSort} />
            </div>
            {displayedRows.length ? displayedRows.map((row, index) => (
              <div className="replay-table-row" key={`${row.timestamp ?? 'row'}-${index}`}>
                <strong>{row.timestamp ?? 'No timestamp'}</strong>
                <span>{row.decision_id ?? `Row ${row.row_index ?? index + 1}`}</span>
                <span>{row.target_ref ?? 'Unknown'}</span>
                <span>{startCase(row.instrument_type ?? 'unknown')}</span>
                <span>{startCase(row.action ?? 'unknown')}</span>
                <span>{startCase(row.disposition ?? 'unknown')}</span>
                <span>{startCase(row.fill_status ?? 'unknown')}</span>
                <span>{formatMetricValue(row.score ?? null, 4)}</span>
                <span>{formatMetricValue(row.net_return ?? null, 4)}</span>
                <span>{formatMetricValue(row.realized_return ?? null, 4)}</span>
                <span>{formatMetricValue(row.cost ?? null, 4)}</span>
                <span>{row.reason_codes?.length ? row.reason_codes.map(startCase).join(', ') : 'None'}</span>
                <span>{replayDecisionRowEvidenceLabels(row).length ? replayDecisionRowEvidenceLabels(row).slice(0, 4).join(' · ') : 'No model evidence ref'}</span>
                <span>{row.decision_trace?.length ? row.decision_trace.map(replayDecisionTraceLabel).slice(0, 5).join(' · ') : 'No trace'}</span>
              </div>
            )) : <div className="empty-chart compact">No replay decisions match the current filter.</div>}
          </div>
        </div>
        </>
      ) : null}
      {!loading && !error && !rows.length ? (
        <div className="empty-chart compact">No replay decision rows are published for this evaluated month.</div>
      ) : null}
    </section>
  );
}

function ReplayMonthlyWindow({
  entry,
  selectedMonth,
  onSelectMonth,
  onClose,
}: {
  entry: ReplayVersionEntry;
  selectedMonth: string | null;
  onSelectMonth: (month: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortState<'month' | 'netReturn' | 'cumulative' | 'drawdown' | 'rowCount'>>({ key: 'month', direction: 'asc' });
  const rows = replayMonthlyRows(entry.version, entry.index);
  const label = compactVersionLabel(entry.version, entry.index);
  const versionId = versionStableId(entry.version, entry.index);
  const activeMonth = selectedMonth ?? rows[0]?.month ?? null;
  const activeRow = rows.find((row) => row.month === activeMonth) ?? null;
  const query = filter.trim().toLowerCase();
  const displayedRows = rows
    .filter((row) => !query || searchText(row.month, row.netReturn, row.cumulative, row.drawdown, row.rowCount).includes(query))
    .sort((left, right) => compareSortValues(left[sort.key], right[sort.key], sort.direction));
  return (
    <section className="replay-detail-window" aria-label="Model Monthly Replay">
      <div className="replay-detail-surface">
        <div className="replay-detail-head">
          <div>
            <span>Historical Replay Detail</span>
            <strong>{label}</strong>
            <small>{rows[0]?.month ?? 'No slices'} to {rows[rows.length - 1]?.month ?? 'No slices'} · {rows.length} evaluated months</small>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className="replay-detail-grid">
          <div className="replay-table replay-monthly-table">
            <div className="dashboard-table-controls">
              <label>
                <span>Filter</span>
                <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter months…" />
              </label>
              <small>Showing {displayedRows.length} of {rows.length}</small>
            </div>
            <div className="replay-table-row replay-table-head">
              <SortableHeader label="Month" column="month" sort={sort} onSort={setSort} />
              <SortableHeader label="Net Return" column="netReturn" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Cumulative" column="cumulative" sort={sort} onSort={setSort} defaultDirection="desc" />
              <SortableHeader label="Max DD" column="drawdown" sort={sort} onSort={setSort} />
              <SortableHeader label="Rows" column="rowCount" sort={sort} onSort={setSort} defaultDirection="desc" />
            </div>
            {displayedRows.length ? displayedRows.map((row) => (
              <button
                className={row.month === activeMonth ? 'replay-table-row selected' : 'replay-table-row'}
                key={row.key}
                type="button"
                onClick={() => onSelectMonth(row.month)}
              >
                <strong>{row.month}</strong>
                <span>{formatMetricValue(row.netReturn, 4)}</span>
                <span>{formatMetricValue(row.cumulative, 4)}</span>
                <span>{formatMetricValue(row.drawdown, 4)}</span>
                <span>{row.rowCount === null ? 'Not reported' : row.rowCount.toFixed(0)}</span>
              </button>
            )) : <div className="empty-chart compact">No monthly replay slices match the current filter.</div>}
          </div>

          <ReplayDecisionDetailTable versionId={versionId} month={activeMonth} activeRow={activeRow} />
        </div>
      </div>
    </section>
  );
}

function ReplayPerformanceView({
  promotionChart,
  replayReviewChart,
}: {
  promotionChart: ModelPromotionPostureChartPayload;
  replayReviewChart: ReplayReviewChartPayload;
}) {
  const versions = groupPromotionVersions({ group_versions: [], layers: [] }, promotionChart);
  const entries = versions.map((version, index) => ({ version, index }));
  const versionIds = versions.map((version, index) => versionStableId(version, index));
  const versionKey = versionIds.join('|');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const reviewRuns = replayReviewRuns(replayReviewChart);
  const reviewIds = reviewRuns.map(replayReviewRunId);
  const reviewKey = reviewIds.join('|');
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds((current) => {
      const valid = new Set(versionIds);
      return current.filter((id) => valid.has(id));
    });
  }, [versionKey]);
  useEffect(() => {
    setSelectedReviewIds((current) => {
      const valid = new Set(reviewIds);
      return current.filter((id) => valid.has(id));
    });
  }, [reviewKey]);
  const selectedEntries = entries.filter(({ version, index }) => selectedIds.includes(versionStableId(version, index)));
  const chartEntries = selectedEntries.length ? selectedEntries : entries;
  const selectedReviewRuns = reviewRuns.filter((run, index) => selectedReviewIds.includes(replayReviewRunId(run, index)));
  const chartReviewRuns = selectedReviewRuns.length ? selectedReviewRuns : reviewRuns;
  return (
    <section className="replay-view">
      <ReplayReviewPageContract chart={replayReviewChart} pageId="replay_performance" />
      <ReplaySelectionModePanel
        mode={selectedReviewRuns.length ? 'focus' : 'summary'}
        summary={selectedReviewRuns.length ? `${selectedReviewRuns.length} replay review runs selected` : `${reviewRuns.length} replay review runs in performance summary`}
        onClear={() => setSelectedReviewIds([])}
      />
      <ReplayReviewRunSelector
        title="Replay Review Performance Selector"
        runs={reviewRuns}
        selectedIds={selectedReviewIds}
        onChange={setSelectedReviewIds}
      />
      <div className="replay-chart-grid">
        <MiniMetricBarChart title="Gross PnL · Replay Review" series={replayReviewMetricSeries(chartReviewRuns, (run) => metricNumber(replayReviewSection(run, 'target_performance'), 'gross_pnl_total'))} emptyLabel="No replay review gross PnL published" />
        <MiniMetricBarChart title="Mean Realized Return · Replay Review" series={replayReviewMetricSeries(chartReviewRuns, (run) => metricNumber(replayReviewSection(run, 'target_performance'), 'mean_realized_return'))} emptyLabel="No replay review realized returns published" />
        <MiniMetricBarChart title="Filled Decisions · Replay Review" series={replayReviewMetricSeries(chartReviewRuns, (run) => metricNumber(replayReviewSection(run, 'decision_scope'), 'filled_count'))} emptyLabel="No replay review fill counts published" />
        <MiniMetricBarChart title="Selected Top 10 · Replay Review" series={replayReviewMetricSeries(chartReviewRuns, (run) => metricNumber(replayReviewSection(run, 'stock_selection'), 'selected_top_10_count'))} emptyLabel="No replay review stock-selection evidence published" />
      </div>
      <ReplayReviewFocusPanel runs={selectedReviewRuns} title="Replay Performance Focus Evidence" />
      <ReplaySelectionModePanel
        mode={selectedEntries.length ? 'focus' : 'summary'}
        summary={selectedEntries.length ? `${selectedEntries.length} selected replay series` : `${entries.length} replay series in summary`}
        onClear={() => setSelectedIds([])}
      />
      <ReplayPerformanceSummaryTable
        entries={entries}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />
      <ReplayPerformanceNavChart entries={chartEntries} />
      <div className="replay-chart-grid">
        <MiniMetricBarChart title="Total Return Compare" series={performanceMetricSeries(chartEntries, 'totalReturn')} emptyLabel="No replay total return metrics published" />
        <MiniMetricBarChart title="Max Drawdown Compare" series={performanceMetricSeries(chartEntries, 'maxDrawdown')} emptyLabel="No replay drawdown metrics published" />
        <MiniMetricBarChart title="Excess Return Compare" series={performanceMetricSeries(chartEntries, 'excessReturn')} emptyLabel="No replay excess return metrics published" />
        <MiniMetricBarChart title="Volatility Compare" series={performanceMetricSeries(chartEntries, 'volatility')} emptyLabel="No replay volatility metrics published" />
        <MiniMetricBarChart title="Sharpe Compare" series={performanceMetricSeries(chartEntries, 'sharpe')} emptyLabel="No replay Sharpe metrics published" />
        <MiniMetricBarChart title="Beta Compare" series={performanceMetricSeries(chartEntries, 'beta')} emptyLabel="No benchmark beta evidence published" />
      </div>
    </section>
  );
}

function ReplayDecisionsView({
  promotionChart,
  replayReviewChart,
}: {
  promotionChart: ModelPromotionPostureChartPayload;
  replayReviewChart: ReplayReviewChartPayload;
}) {
  const versions = groupPromotionVersions({ group_versions: [], layers: [] }, promotionChart);
  const entries = versions.map((version, index) => ({ version, index }));
  const versionIds = versions.map((version, index) => versionStableId(version, index));
  const versionKey = versionIds.join('|');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const reviewRuns = replayReviewRuns(replayReviewChart);
  const reviewIds = reviewRuns.map(replayReviewRunId);
  const reviewKey = reviewIds.join('|');
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [monthlyVersionId, setMonthlyVersionId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  useEffect(() => {
    setSelectedIds((current) => {
      const valid = new Set(versionIds);
      return current.filter((id) => valid.has(id));
    });
  }, [versionKey]);
  useEffect(() => {
    setSelectedReviewIds((current) => {
      const valid = new Set(reviewIds);
      return current.filter((id) => valid.has(id));
    });
  }, [reviewKey]);
  const selectedEntries = entries.filter(({ version, index }) => selectedIds.includes(versionStableId(version, index)));
  const selectedVersion = selectedEntries[0]?.version ?? null;
  const chartEntries = selectedEntries.length ? selectedEntries : entries;
  const monthlyEntry = entries.find(({ version, index }) => versionStableId(version, index) === monthlyVersionId) ?? null;
  const selectedReviewRuns = reviewRuns.filter((run, index) => selectedReviewIds.includes(replayReviewRunId(run, index)));
  const chartReviewRuns = selectedReviewRuns.length ? selectedReviewRuns : reviewRuns;
  const layerCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewDecision(run), 'miss_attribution_layer_counts'));
  const causeCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewDecision(run), 'cause_family_counts'));
  const parameterCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewParameter(run), 'classification_counts'));
  return (
    <section className="replay-view">
      <ReplayReviewPageContract chart={replayReviewChart} pageId="replay_decisions" />
      <ReplaySelectionModePanel
        mode={selectedReviewRuns.length ? 'focus' : 'summary'}
        summary={selectedReviewRuns.length ? `${selectedReviewRuns.length} replay review runs selected` : `${reviewRuns.length} replay review runs in model-layer decision summary`}
        onClear={() => setSelectedReviewIds([])}
      />
      <ReplayReviewRunSelector
        title="Model-Layer Decision Review Selector"
        runs={reviewRuns}
        selectedIds={selectedReviewIds}
        onChange={setSelectedReviewIds}
      />
      <div className="replay-chart-grid">
        <MiniMetricBarChart title="Miss Attribution Layer" series={countSeriesFromRecord(layerCounts)} emptyLabel="No layer attribution counts published" />
        <MiniMetricBarChart title="Cause Family" series={countSeriesFromRecord(causeCounts)} emptyLabel="No cause-family counts published" />
        <MiniMetricBarChart title="Parameter Review Classes" series={countSeriesFromRecord(parameterCounts)} emptyLabel="No parameter replay review classifications published" />
        <MiniMetricBarChart title="Regret To Best Available" series={replayReviewMetricSeries(chartReviewRuns, (run) => metricNumber(replayReviewDecision(run), 'mean_regret_to_best_available'))} emptyLabel="No regret-to-best-available metrics published" />
      </div>
      <ReplayReviewFocusPanel runs={selectedReviewRuns} title="Model-Layer Decision Focus Evidence" />
      <ReplaySelectionModePanel
        mode={selectedEntries.length ? 'focus' : 'summary'}
        summary={selectedEntries.length === 1 ? `Focused on ${compactVersionLabel(selectedEntries[0].version, selectedEntries[0].index)}` : selectedEntries.length ? `${selectedEntries.length} selected replay versions` : `${entries.length} replay versions in decision summary`}
        onClear={() => {
          setSelectedIds([]);
          setMonthlyVersionId(null);
          setSelectedMonth(null);
        }}
      />
      <ReplayDecisionVersionSelector
        versions={versions}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        onOpenMonthly={(id) => {
          setSelectedIds([id]);
          setMonthlyVersionId(id);
          setSelectedMonth(null);
        }}
      />
      {selectedEntries.length === 1 ? (
        <div className="replay-chart-grid">
          <ScoreDecileReturnCurve version={selectedVersion} emptyLabel="Select a replay version with score decile return evidence" />
          <ThresholdReturnCurve version={selectedVersion} emptyLabel="Select a replay version with threshold return evidence" />
          <CostSensitivityCurve version={selectedVersion} emptyLabel="Select a replay version with cost sensitivity evidence" />
          <SliceDistributionPanel version={selectedVersion} />
        </div>
      ) : (
        <div className="replay-chart-grid">
          <MiniMetricBarChart title="Decision Rows Compare" series={replayOutcomeMetricSeries(chartEntries, 'decisionRows')} emptyLabel="No replay decision row counts published" />
          <MiniMetricBarChart title="Accepted Compare" series={replayOutcomeMetricSeries(chartEntries, 'accepted')} emptyLabel="No accepted decision counts published" />
          <MiniMetricBarChart title="Filled Compare" series={replayOutcomeMetricSeries(chartEntries, 'filled')} emptyLabel="No replay fill counts published" />
          <MiniMetricBarChart title="Taken Good Compare" series={replayOutcomeMetricSeries(chartEntries, 'takenGood')} emptyLabel="No taken-good counts published" />
          <MiniMetricBarChart title="Avoided Bad Compare" series={replayOutcomeMetricSeries(chartEntries, 'avoidedBad')} emptyLabel="No avoided-bad counts published" />
          <MiniMetricBarChart title="Missed Good Compare" series={replayOutcomeMetricSeries(chartEntries, 'missedGood')} emptyLabel="No missed-good counts published" />
        </div>
      )}
      {monthlyEntry ? (
        <ReplayMonthlyWindow
          entry={monthlyEntry}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          onClose={() => {
            setMonthlyVersionId(null);
            setSelectedMonth(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ReplayOperationsView({
  promotionChart,
  replayReviewChart,
}: {
  promotionChart: ModelPromotionPostureChartPayload;
  replayReviewChart: ReplayReviewChartPayload;
}) {
  const versions = groupPromotionVersions({ group_versions: [], layers: [] }, promotionChart);
  const reviewRuns = replayReviewRuns(replayReviewChart);
  const reviewIds = reviewRuns.map(replayReviewRunId);
  const reviewKey = reviewIds.join('|');
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedReviewIds((current) => {
      const valid = new Set(reviewIds);
      return current.filter((id) => valid.has(id));
    });
  }, [reviewKey]);
  const selectedReviewRuns = reviewRuns.filter((run, index) => selectedReviewIds.includes(replayReviewRunId(run, index)));
  const chartReviewRuns = selectedReviewRuns.length ? selectedReviewRuns : reviewRuns;
  const firstGapCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewDecision(run), 'first_gap_component_counts'));
  const optionPathCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewSection(run, 'option_expression'), 'path_status_counts'));
  const replacementCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewSection(run, 'replacement_review'), 'replacement_status_counts'));
  const fillCounts = aggregateCounts(chartReviewRuns, (run) => countRecord(replayReviewSection(run, 'decision_scope'), 'fill_status_counts'));
  const operationReadyCount = versions.filter((version) => {
    const metrics = version.metrics ?? {};
    return Boolean(
      nestedRecord(metrics, 'component_health_diagnostics')
      ?? nestedRecord(metrics, 'replay_operation_diagnostics')
      ?? nestedRecord(metrics, 'source_data_readiness'),
    );
  }).length;
  return (
    <section className="replay-view">
      <ReplayReviewPageContract chart={replayReviewChart} pageId="replay_operations" />
      <ReplaySelectionModePanel
        mode={selectedReviewRuns.length ? 'focus' : 'summary'}
        summary={selectedReviewRuns.length ? `${selectedReviewRuns.length} replay review runs selected` : `${reviewRuns.length} replay review runs in operation summary`}
        onClear={() => setSelectedReviewIds([])}
      />
      <ReplayReviewRunSelector
        title="Replay Operation Review Selector"
        runs={reviewRuns}
        selectedIds={selectedReviewIds}
        onChange={setSelectedReviewIds}
      />
      <div className="replay-chart-grid">
        <MiniMetricBarChart title="First Gap Component" series={countSeriesFromRecord(firstGapCounts)} emptyLabel="No first-gap component counts published" />
        <MiniMetricBarChart title="Option Path Status" series={countSeriesFromRecord(optionPathCounts)} emptyLabel="No option path status counts published" />
        <MiniMetricBarChart title="Replacement Status" series={countSeriesFromRecord(replacementCounts)} emptyLabel="No replacement review counts published" />
        <MiniMetricBarChart title="Fill Status" series={countSeriesFromRecord(fillCounts)} emptyLabel="No fill-status counts published" />
      </div>
      <ReplayReviewFocusPanel runs={selectedReviewRuns} title="Replay Operation Focus Evidence" />
      <ReplaySelectionModePanel
        mode="summary"
        summary={`${versions.length} promotion-posture replay versions · ${operationReadyCount} with legacy operation diagnostics`}
      />
      <section className="panel replay-operations-placeholder">
        <div className="panel-heading">Legacy Operation Evidence</div>
        <p className="panel-subtitle">Component execution surfaces now come from replay review when published. This legacy section only reports operation diagnostics still embedded in promotion posture.</p>
        <div className="metric-grid three">
          <MetricCard label="Replay versions" value={versions.length} hint="Published model-group replay versions" />
          <MetricCard label="Operation diagnostics" value={operationReadyCount} hint="Component operation evidence with current read model fields" />
          <MetricCard label="Decision evidence" value="Moved" hint="Use Replay Decisions for component decision drilldown" />
        </div>
        {operationReadyCount ? (
          <div className="replay-operation-list">
            {versions.map((version, index) => {
              const metrics = version.metrics ?? {};
              const diagnostics = nestedRecord(metrics, 'replay_operation_diagnostics') ?? nestedRecord(metrics, 'component_health_diagnostics') ?? nestedRecord(metrics, 'source_data_readiness');
              if (!diagnostics) return null;
              return (
                <div className="replay-operation-row" key={versionStableId(version, index)}>
                  <strong>{compactVersionLabel(version, index)}</strong>
                  <span>{startCase(String(diagnostics.status ?? version.decision_status ?? 'reported'))}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-chart compact">No replay operation timeline, component health, or source-readiness diagnostics are published in the current read model.</div>
        )}
      </section>
    </section>
  );
}

function ReplayEventsView({ replayReviewChart }: { replayReviewChart: ReplayReviewChartPayload }) {
  const eventRuns = replayEventRuns(replayReviewChart);
  const [selectedEventRunId, setSelectedEventRunId] = useState<string | null>(null);
  const eventRunIds = eventRuns.map((run, index) => String(run.event_run_id ?? index));
  const eventRunKey = eventRunIds.join('|');
  useEffect(() => {
    if (selectedEventRunId && !eventRunIds.includes(selectedEventRunId)) setSelectedEventRunId(null);
  }, [eventRunKey, selectedEventRunId]);
  const selectedRun = eventRuns.find((run, index) => String(run.event_run_id ?? index) === selectedEventRunId) ?? null;
  const chartRuns = selectedRun ? [selectedRun] : eventRuns;
  const proposalCounts = aggregateCounts(chartRuns, (run) => countRecord(run, 'proposal_status_counts'));
  const reviewGateCounts = aggregateCounts(chartRuns, (run) => countRecord(run, 'review_gate_counts'));
  const impactScopeCounts = aggregateCounts(chartRuns, (run) => countRecord(run, 'impact_scope_type_counts'));
  const attributionCounts = aggregateCounts(chartRuns, (run) => countRecord(run, 'attribution_status_counts'));
  return (
    <section className="replay-view">
      <ReplayReviewPageContract chart={replayReviewChart} pageId="events" />
      <ReplaySelectionModePanel
        mode={selectedRun ? 'focus' : 'summary'}
        summary={selectedRun ? `Focused on ${String(selectedRun.event_run_id ?? 'event run')}` : `${eventRuns.length} residual event governance runs in summary`}
        onClear={() => setSelectedEventRunId(null)}
      />
      <section className="panel replay-table-panel">
        <div className="panel-heading">Event Governance Runs</div>
        <div className="replay-table replay-event-summary-table">
          <div className="replay-table-row replay-table-head">
            <span>Run</span>
            <span>Proposals</span>
            <span>Attributions</span>
            <span>Targets</span>
            <span>Failure Types</span>
            <span>Action</span>
          </div>
          {eventRuns.length ? eventRuns.map((run, index) => {
            const id = String(run.event_run_id ?? index);
            const selected = id === selectedEventRunId;
            return (
              <div
                className={selected ? 'replay-table-row selected' : 'replay-table-row'}
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEventRunId(selected ? null : id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedEventRunId(selected ? null : id);
                  }
                }}
              >
                <strong><i style={{ background: SCATTER_GROUP_COLORS[index % SCATTER_GROUP_COLORS.length] }} />{id}</strong>
                <span>{formatMetricValue(metricNumber(run, 'proposal_count'), 0)}</span>
                <span>{formatMetricValue(metricNumber(run, 'attribution_row_count'), 0)}</span>
                <span>{countSeriesFromRecord(countRecord(run, 'target_symbol_counts')).slice(0, 3).map((item) => `${item.label} ${item.value}`).join(' · ') || 'None'}</span>
                <span>{countSeriesFromRecord(countRecord(run, 'failure_type_counts')).slice(0, 3).map((item) => `${item.label} ${item.value}`).join(' · ') || 'None'}</span>
                <button className="replay-inline-action" type="button" onClick={(event) => { event.stopPropagation(); setSelectedEventRunId(id); }}>Focus</button>
              </div>
            );
          }) : <div className="empty-chart compact">No residual event governance runs are published in the current replay review read model.</div>}
        </div>
      </section>
      <div className="replay-chart-grid">
        <MiniMetricBarChart title="Proposal Status" series={countSeriesFromRecord(proposalCounts)} emptyLabel="No event proposal status counts published" />
        <MiniMetricBarChart title="Review Gates" series={countSeriesFromRecord(reviewGateCounts)} emptyLabel="No event review gate counts published" />
        <MiniMetricBarChart title="Impact Scope" series={countSeriesFromRecord(impactScopeCounts)} emptyLabel="No event impact-scope counts published" />
        <MiniMetricBarChart title="Attribution Status" series={countSeriesFromRecord(attributionCounts)} emptyLabel="No event attribution status counts published" />
      </div>
      {selectedRun ? (
        <section className="panel replay-review-focus-panel">
          <div className="panel-heading">Event Focus Detail</div>
          <div className="replay-review-focus-grid">
            {nestedArray(selectedRun, 'sample_proposals').map((proposal, index) => (
              <div className="replay-review-focus-card" key={`${proposal.event_focus_proposal_id ?? index}`}>
                <strong>{String(proposal.event_summary ?? proposal.event_ref ?? `Proposal ${index + 1}`)}</strong>
                <span>{String(proposal.target_symbol ?? 'Unknown target')} · {startCase(String(proposal.failure_type ?? 'unknown'))}</span>
                <small>{String(proposal.review_gate ?? proposal.proposal_status ?? 'No gate')}</small>
              </div>
            ))}
            {nestedArray(selectedRun, 'sample_attributions').map((attribution, index) => (
              <div className="replay-review-focus-card" key={`${attribution.attribution_id ?? attribution.dominant_event_candidate ?? index}`}>
                <strong>{String(attribution.dominant_event_candidate ?? `Attribution ${index + 1}`)}</strong>
                <span>{String(attribution.target_symbol ?? 'Unknown target')} · {startCase(String(attribution.impact_scope_type ?? 'unknown'))}</span>
                <small>{startCase(String(attribution.attribution_status ?? 'unknown'))} · source {String(attribution.source_replay_review_id ?? 'not linked')}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ModelGroupDetail({
  layerChart,
  runtimeChart,
  promotionChart,
}: {
  layerChart: ModelLayerReadinessChartPayload;
  runtimeChart: ExecutionRuntimeStatusChartPayload;
  promotionChart: ModelPromotionPostureChartPayload;
}) {
  const versions = groupPromotionVersions(layerChart, promotionChart);
  const exclusions = groupPromotionExclusions(promotionChart);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [autoSelectedVersionKey, setAutoSelectedVersionKey] = useState<string | null>(null);
  const [scatterGroupKey, setScatterGroupKey] = useState<ScatterGroupKey>('decision_intended_side');
  const versionKey = versions.map((version, index) => versionStableId(version, index)).join('|');
  const activeRef = activeModelRef(runtimeChart);
  const activeVersion = versions.find((version) => modelIdentity(version) === 'active') ?? null;
  const selectedVersion = versions.find((version, index) => versionStableId(version, index) === selectedVersionId) ?? null;
  const pcaVersion = selectedVersion && diagnosticPoints(selectedVersion, 'pca').length ? selectedVersion : null;
  const pcoaVersion = selectedVersion && diagnosticPoints(selectedVersion, 'pcoa').length ? selectedVersion : null;
  useEffect(() => {
    const validIds = new Set(versions.map((version, index) => versionStableId(version, index)));
    if (selectedVersionId && !validIds.has(selectedVersionId)) {
      setSelectedVersionId(null);
      setAutoSelectedVersionKey(null);
      return;
    }
    if (selectedVersionId || autoSelectedVersionKey === versionKey) return;
    const defaultEntry = versions
      .map((version, index) => ({ version, index, id: versionStableId(version, index) }))
      .find(({ version }) => diagnosticPoints(version, 'pca').length || diagnosticPoints(version, 'pcoa').length);
    if (defaultEntry) setSelectedVersionId(defaultEntry.id);
    setAutoSelectedVersionKey(versionKey);
  }, [autoSelectedVersionKey, selectedVersionId, versionKey, versions]);
  return (
    <section className="panel model-group-detail-panel">
      <div className="model-group-detail-head">
        <div>
          <div className="panel-heading">0 · Model Group Versions</div>
          <p className="panel-subtitle">No selected model means summary comparison. Selecting one model switches the charts into focus diagnostics for that version.</p>
        </div>
        <StatusPill status={`${versions.length} versions`} severity="info" />
      </div>
      <ReplaySelectionModePanel
        mode={selectedVersion ? 'focus' : 'summary'}
        summary={selectedVersion ? `Focused on ${compactVersionLabel(selectedVersion, 0)}` : `${versions.length} model versions in summary`}
        onClear={() => setSelectedVersionId(null)}
      />
      <ActiveModelEvidence activeVersion={activeVersion} activeRef={activeRef} />
      <ModelVersionTable versions={versions} selectedVersionId={selectedVersionId} onSelectVersion={setSelectedVersionId} />
      <ExcludedPromotionEvidencePanel exclusions={exclusions} />
      <IdentityDistribution versions={versions} />
      {selectedVersion ? (
        <>
          <EvaluationDisagreementPanel version={selectedVersion} />
          <ModelScorecardSection title="Ranking / Calibration" subtitle="Focused prediction sorting and probability quality for the selected model.">
            <RocCurveChart version={selectedVersion} emptyLabel="ROC curve not published" />
            <AdaptiveDiagnosticChart title="Brier" globalSeries={[]} selectedVersion={selectedVersion} selectedKind="monthly_brier" emptyLabel="Brier series not published" />
            <AdaptiveDiagnosticChart title="Calibration" globalSeries={[]} selectedVersion={selectedVersion} selectedKind="calibration" emptyLabel="Calibration series not published" />
            <BrierDecompositionChart version={selectedVersion} />
          </ModelScorecardSection>
          <ModelScorecardSection title="Selection Diagnostics" subtitle="Decision-variable schema and label coverage used for model review; trading-distribution slices live under Replay Operations.">
            <DecisionVariableAuditPanel version={selectedVersion} />
          </ModelScorecardSection>
          <ModelScorecardSection title="Feature Space" subtitle="Feature-space separation views for the selected model.">
            <AdaptiveDiagnosticChart title="Silhouette" globalSeries={[]} selectedVersion={selectedVersion} selectedKind="silhouette" emptyLabel="Silhouette series not published" />
            <FeatureScatterChart title="PCA Feature Space" version={pcaVersion} diagnosticKey="pca" groupKey={scatterGroupKey} onGroupKeyChange={setScatterGroupKey} emptyLabel="PCA diagnostics not published" />
            <FeatureScatterChart title="PCoA Distance Space" version={pcoaVersion} diagnosticKey="pcoa" groupKey={scatterGroupKey} onGroupKeyChange={setScatterGroupKey} emptyLabel="PCoA diagnostics not published" />
          </ModelScorecardSection>
          <ModelScorecardSection title="Integrity / Uncertainty" subtitle="Focused model evidence quality checks that do not depend on replay economics.">
            <DataIntegrityPanel version={selectedVersion} />
          </ModelScorecardSection>
          <ModelScorecardSection title="Temporal Stability" subtitle="Fold-month stability tests for the selected model.">
            <TemporalDiagnosticCurve title="Monthly AUROC" version={selectedVersion} metricKey="auroc" emptyLabel="Monthly AUROC diagnostics not published" />
            <TemporalDiagnosticCurve title="Monthly Brier" version={selectedVersion} metricKey="brier_score" emptyLabel="Monthly Brier diagnostics not published" />
          </ModelScorecardSection>
        </>
      ) : (
        <>
          <ModelScorecardSection title="Ranking / Calibration Summary" subtitle="Global model-validity comparison across every published model version.">
          <MiniMetricBarChart title="AUROC · Global Compare" series={versionMetricSeries(versions, 'auroc')} emptyLabel="AUROC series not published" />
            <MiniMetricBarChart title="PR-AUC · Global Compare" series={versionMetricSeries(versions, 'pr_auc')} emptyLabel="PR-AUC series not published" />
            <MiniMetricBarChart title="Brier · Global Compare" series={versionMetricSeries(versions, 'brier_score')} emptyLabel="Brier series not published" />
            <MiniMetricBarChart title="ECE · Global Compare" series={versionMetricSeries(versions, 'ece')} emptyLabel="ECE series not published" />
          </ModelScorecardSection>
          <ModelScorecardSection title="Feature / Integrity Summary" subtitle="Global feature-space and quality summary. Select a model row to inspect PCA, PCoA, schema coverage, and monthly stability.">
            <MiniMetricBarChart title="Silhouette · Global Compare" series={versionMetricSeries(versions, 'silhouette_outcome_label')} emptyLabel="Silhouette series not published" />
            <MiniMetricBarChart title="Raw Rows · Global Compare" series={versionMetricSeries(versions, 'raw_row_count')} emptyLabel="Raw row counts not published" />
            <MiniMetricBarChart title="Evaluated Rows · Global Compare" series={versionMetricSeries(versions, 'evaluated_row_count')} emptyLabel="Evaluated row counts not published" />
            <MiniMetricBarChart title="Validation Exclusions · Global Compare" series={versionMetricSeries(versions, 'validation_row_excluded_count')} emptyLabel="Validation exclusion counts not published" />
          </ModelScorecardSection>
        </>
      )}
    </section>
  );
}

function TaskDetailPanel({ task }: { task: HistoricalTaskTimelineItemPayload }) {
  const detail = task.detail ?? {};
  const progress = detail.progress;
  const execution = detail.last_execution;
  const blockers = detail.blockers ?? [];
  const receipts = detail.receipt_refs ?? [];
  const failureRegister = detail.failure_register ?? null;
  const failureCount = failureRegister?.failure_count ?? 0;
  const autoRepairRequiredCount = failureRegister?.auto_repair_required_count ?? 0;
  const agentReviewRequiredCount = failureRegister?.agent_review_required_count ?? 0;
  const retryRequiredCount = failureRegister?.retry_required_count ?? 0;
  const correctedCount = failureRegister?.corrected_count ?? 0;
  const acceptedSkipCount = failureRegister?.accepted_skip_count ?? 0;
  const resolvedFailureCount = correctedCount + acceptedSkipCount;
  const pendingFailureCount = autoRepairRequiredCount + agentReviewRequiredCount + retryRequiredCount;
  const failureRegisterSolved = failureCount > 0 && pendingFailureCount === 0 && resolvedFailureCount >= failureCount;
  const failureRegisterSummary = failureRegisterSolved
    ? `${failureCount} failed request${failureCount === 1 ? '' : 's'} solved`
    : [
        resolvedFailureCount > 0
          ? `${resolvedFailureCount}/${failureCount} failed request${failureCount === 1 ? '' : 's'} solved`
          : `${failureCount} failed request${failureCount === 1 ? '' : 's'} tracked`,
        autoRepairRequiredCount > 0 ? `${autoRepairRequiredCount} automatic repair${autoRepairRequiredCount === 1 ? '' : 's'} pending` : null,
        retryRequiredCount > 0 ? `${retryRequiredCount} retr${retryRequiredCount === 1 ? 'y' : 'ies'} pending` : null,
        agentReviewRequiredCount > 0 ? `${agentReviewRequiredCount} control decision${agentReviewRequiredCount === 1 ? '' : 's'} pending` : null,
      ].filter(Boolean).join(' · ');
  const topFailure = failureRegister?.top_errors?.[0] ?? null;
  const topFailureCount = topFailure?.count ?? failureCount;
  const topFailureCountLabel = failureRegisterSolved
    ? `${topFailureCount} solved`
    : `${topFailureCount} occurrence${topFailureCount === 1 ? '' : 's'}`;
  const agentErrors = detail.agent_error_summary ?? [];
  const latestAgentError = agentErrors[0] ?? null;
  const repairInterventionStatus = detail.repair_intervention_status ?? null;
  const latestAgentRepairStatus = latestAgentError
    ? agentInterventionStatus(latestAgentError.diagnosis_status, latestAgentError.repair_status, latestAgentError.runner_command)
    : null;
  const latestAgentErrorRef = latestAgentError?.error_ref ? String(latestAgentError.error_ref) : null;
  const latestAgentRootCause = latestAgentError ? diagnosticText(latestAgentError.root_cause ?? latestAgentError.summary, '') : '';
  const latestAgentRetry = latestAgentError?.retry_recommendation ? String(latestAgentError.retry_recommendation) : '';
  const progressView = taskProgressView(task);
  const runtimeActivity = derivedTaskLiveActivity(task);
  const runtimeDetailLines = runtimeActivitySupplementalLines(runtimeActivity).filter((line) => line !== task.reason);
  const logEntries = taskLogTailEntries(task);
  return (
    <div className="task-detail-panel">
      <div className="task-detail-grid">
        <div className="task-detail-card">
          <span>Task identity</span>
          <strong>{monthLabel(task.month)} · {task.task_label}</strong>
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
            <small><b>Started</b>{timestampText(task.started_at_utc)}</small>
            <small><b>Runtime</b>{taskRuntimeText(task)}</small>
            <small><b>Ended</b>{timestampText(task.ended_at_utc)}</small>
          </div>
        </div>
        {progress ? (
          <div className="task-detail-card wide-detail">
            <span>Current progress</span>
            <strong>{progressView.label}</strong>
            {progressView.hasBar ? (
              <div className="mini-progress" aria-label={`Task progress ${progressView.label}`}>
                <div className={`mini-progress-fill${progressView.failed ? ' failed' : ''}`} style={{ width: `${progressView.percent}%` }} />
              </div>
            ) : null}
            <small>{progressView.hint}</small>
          </div>
        ) : (
          <div className="task-detail-card wide-detail">
            <span>Current progress</span>
            <strong>{progressView.label}</strong>
            {progressView.hasBar ? (
              <div className="mini-progress" aria-label={`Task progress ${progressView.label}`}>
                <div className={`mini-progress-fill${progressView.failed ? ' failed' : ''}`} style={{ width: `${progressView.percent}%` }} />
              </div>
            ) : null}
            <small>{progressView.hint}</small>
          </div>
        )}
        {runtimeActivity ? (
          <div className="task-detail-card wide-detail">
            <span>Live</span>
            <strong>{runtimeActivitySummary(runtimeActivity)}</strong>
            {runtimeDetailLines.map((line) => <small key={line}>{line}</small>)}
            {runtimeActivity.required_next_step ? <small>Next {startCase(runtimeActivity.required_next_step)}</small> : null}
            {runtimeActivity.updated_at_utc ? <small>Updated {formatTimestamp(runtimeActivity.updated_at_utc)}</small> : null}
          </div>
        ) : null}
        {logEntries.length ? (
          <div className="task-detail-card wide-detail">
            <span>Logs</span>
            <strong>{logEntries.length} active stream{logEntries.length === 1 ? '' : 's'}</strong>
            <div className="task-log-tail">
              {logEntries.map((entry, entryIndex) => (
                <div className="task-log-stream" key={`${entry.path ?? entry.stream ?? 'log'}-${entryIndex}`}>
                  <div className="task-log-stream-head">
                    <b>{String(entry.stream || 'log').toUpperCase()}</b>
                    <small>{entry.updated_at_utc ? formatTimestamp(entry.updated_at_utc) : entry.path?.split('/').pop() ?? ''}</small>
                  </div>
                  <pre>{(entry.lines ?? []).length ? (entry.lines ?? []).join('\n') : 'No log lines yet.'}</pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {execution ? (
          <div className="task-detail-card wide-detail">
            <span>Latest execution</span>
            <strong>{startCase(execution.status)}</strong>
            <small>{execution.return_code === undefined || execution.return_code === null ? 'No return code recorded' : `Return code ${execution.return_code}`}</small>
            {execution.reason ? <small>{execution.reason}</small> : null}
          </div>
        ) : null}
        {failureRegister && failureCount > 0 ? (
          <div className={`task-detail-card wide-detail${failureRegisterSolved ? ' task-detail-card--resolved' : ''}`}>
            <span>Failure register</span>
            <strong>{failureRegisterSummary}</strong>
            {topFailure?.error_summary ? <small>{topFailureCountLabel} · {topFailure.error_summary}</small> : null}
            {failureRegister.latest_updated_at_utc ? <small>Latest update {formatTimestamp(failureRegister.latest_updated_at_utc)}</small> : null}
          </div>
        ) : null}
        {repairInterventionStatus || latestAgentError ? (
          <div className="task-detail-card wide-detail">
            <span>Repair intervention</span>
            <strong>{startCase(repairInterventionStatus ?? latestAgentRepairStatus ?? 'not reported')}</strong>
            {latestAgentError ? (
              <small>
                {[latestAgentErrorRef, latestAgentRepairStatus ? startCase(latestAgentRepairStatus) : null, latestAgentError.handling_status ? startCase(latestAgentError.handling_status) : null].filter(Boolean).join(' · ')}
              </small>
            ) : null}
            {latestAgentRootCause ? <small>{latestAgentRootCause}</small> : null}
            {latestAgentRetry ? <small>Retry: {startCase(latestAgentRetry)}</small> : null}
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
      title: 'Status read model',
      category: 'Read model',
      typeKey: 'read_model',
      typeLabel: 'Read Model',
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
      typeKey: 'read_model',
      typeLabel: 'Read Model',
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
      typeKey: 'service',
      typeLabel: 'Service',
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
      typeKey: 'source_connection',
      typeLabel: 'Source Connection',
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
      typeKey: 'dashboard_data',
      typeLabel: 'Dashboard Data',
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
      typeKey: 'task',
      typeLabel: 'Task',
      status: 'Failed',
      detail: `${monthLabel(task.month)} · ${task.task_label} · ${startCase(task.stage_type)}${task.reason ? ` · ${task.reason}` : ''}`,
      severity: 'error',
      handlingStatus: 'open',
      occurredAt: task.status_updated_at_utc ?? task.updated_at_utc ?? task.ended_at_utc,
    });
  });
  (chart.task_timeline ?? []).filter((task) => {
    const progress = task.detail?.progress;
    if (!progress || task.task_state === 'future' || progress.can_unlock_downstream === true) return false;
    return Math.max(0, (progress.failed_count ?? 0) - (progress.accepted_failed_count ?? 0)) > 0;
  }).slice(0, 20).forEach((task) => {
    const progress = task.detail?.progress;
    const unresolvedFailedCount = Math.max(0, (progress?.failed_count ?? 0) - (progress?.accepted_failed_count ?? 0));
    items.push({
      id: stableDiagnosticId('task-coverage', task.task_uid || `${task.month ?? 'unknown'}-${task.task_id}`),
      title: task.task_label,
      category: 'Task coverage',
      typeKey: 'task_coverage',
      typeLabel: 'Task Coverage',
      status: 'Action Required',
      detail: `${monthLabel(task.month)} · ${task.task_label} · ${unresolvedFailedCount}/${progress?.expected_count ?? 0} unresolved requests failed; downstream remains blocked.`,
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
      typeKey: String(error.error_kind ?? 'agent_error').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_|_$/gu, '') || 'agent_error',
      typeLabel: startCase(String(error.error_kind ?? 'Agent error')),
      status: startCase(repairStatus),
      detail: `${rootCause}${retry}`,
      severity: diagnosticSeverityFromValue(error.dashboard_severity ?? error.severity),
      handlingStatus: agentHandlingStatus(error),
      agentInterventionStatus: repairStatus,
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
      typeKey: String(record.issue_type ?? record.ref_type ?? record.contract_type ?? 'issue_ref').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_|_$/gu, '') || 'issue_ref',
      typeLabel: refTitle(ref, 'Issue Ref'),
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
  );
}

function TaskTimelineList({ tasks }: { tasks: HistoricalTaskTimelineItemPayload[] }) {
  const [monthFilter, setMonthFilter] = useState('auto');
  const [stateFilter, setStateFilter] = useState('auto');
  const [taskFilter, setTaskFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const monthOptions = useMemo(() => uniqueTaskOptions(tasks, taskMonthFilterValue, (task) => monthLabel(task.month), monthOptionRank), [tasks]);
  const stateOptions = useMemo(() => uniqueTaskOptions(tasks, (task) => task.task_state, taskStateLabel, taskStateOptionRank), [tasks]);
  const taskOptions = useMemo(
    () => uniqueTaskOptions(tasks, taskFilterValue, taskFilterLabel, taskOptionRank),
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
      if (effectiveStateFilter !== 'all' && task.task_state !== effectiveStateFilter) return false;
      if (taskFilter !== 'all' && taskFilterValue(task) !== taskFilter) return false;
      if (targetFilter !== 'all' && taskTargetFilterValue(task) !== targetFilter) return false;
      return true;
    }),
    [effectiveMonthFilter, effectiveStateFilter, targetFilter, tasks, taskFilter],
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
  }, [effectiveMonthFilter, effectiveStateFilter, targetFilter, taskFilter]);

  const renderTaskRow = (task: HistoricalTaskTimelineItemPayload) => {
    const taskKey = taskRowKey(task);
    const isExpanded = expandedTasks.has(taskKey);
    const progress = taskProgressView(task);
    const runtimeActivity = derivedTaskLiveActivity(task);
    const rawRuntimeDetailLine = runtimeActivityPreviewLine(runtimeActivity);
    const runtimeDetailLine = rawRuntimeDetailLine === task.reason ? '' : rawRuntimeDetailLine;
    return (
      <article className={`task-row task-${task.task_state}`} key={taskKey} role="listitem">
        <div className="task-index">{task.task_number ?? task.sequence}</div>
        <div className="task-main">
          <div className="task-title-row">
            <strong>{task.task_label}</strong>
            <div className="task-title-badges">
              <StatusPill status={taskStateLabel(task)} severity={taskStateSeverity(task.task_state)} />
            </div>
          </div>
          <div className="task-meta">
            <span>{monthLabel(task.month)}</span>
            {taskTargetMetaLabel(task) ? <span>{taskTargetMetaLabel(task)}</span> : null}
            <span>{startCase(task.stage_type)}</span>
            <span>{startCase(task.status)}</span>
            <span>Runtime {taskRuntimeText(task)}</span>
          </div>
          {!isExpanded ? (
            <div className={`task-row-progress${progress.hasEvidence ? '' : ' inferred'}${progress.failed ? ' failed' : ''}`}>
              <div className="task-row-progress-copy">
                <span>{progress.label}</span>
                <small>{progress.hint}</small>
              </div>
              {progress.hasBar ? (
                <div className="mini-progress" aria-label={`Task progress ${progress.label}`}>
                  <div className={`mini-progress-fill${progress.failed ? ' failed' : ''}`} style={{ width: `${progress.percent}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {!isExpanded && runtimeActivity ? (
            <div className="task-live-activity">
              <span>Live</span>
              <strong>{runtimeActivitySummary(runtimeActivity)}</strong>
              {runtimeDetailLine ? <small>{runtimeDetailLine}</small> : null}
            </div>
          ) : null}
          {!isExpanded && !runtimeActivity && task.reason ? <div className="task-reason">{task.reason}</div> : null}
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
        <button className="secondary-button" type="button" onClick={() => { setMonthFilter('auto'); setStateFilter('auto'); setTaskFilter('all'); setTargetFilter('all'); setExpandedTasks(new Set()); }}>
          Reset filters
        </button>
      </div>
      <div className="task-filters" aria-label="Task list filters">
        <SearchableFilter
          label="Month"
          listId="task-month-options"
          value={monthFilter}
          options={[["auto", "Active/latest period"], ["all", "All months"], ...monthOptions]}
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
          <span>Task</span>
          <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
            <option value="all">All tasks</option>
            {taskOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="auto">Active if available</option>
            <option value="all">All statuses</option>
            {stateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
      {selectedSpec ? <p className="dashboard-data-note">{selectedSpec.label} · {selectedSpec.description}</p> : null}
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<DiagnosticStatusFilter>('unresolved');
  const typeOptions = useMemo(() => diagnosticTypeOptions(items), [items]);
  const scopedItems = useMemo(() => items.filter((item) => {
    if (typeFilter !== 'all' && item.typeKey !== typeFilter) return false;
    if (statusFilter === 'unresolved') return isUnresolvedDiagnostic(item);
    if (statusFilter !== 'all' && item.handlingStatus !== statusFilter) return false;
    return true;
  }), [items, statusFilter, typeFilter]);
  const severityCounts = {
    critical: scopedItems.filter((item) => item.severity === 'critical').length,
    error: scopedItems.filter((item) => item.severity === 'error').length,
    warning: scopedItems.filter((item) => item.severity === 'warning').length,
    notice: scopedItems.filter((item) => item.severity === 'notice').length,
  };
  const filteredItems = severityFilter === 'all' ? scopedItems : scopedItems.filter((item) => item.severity === severityFilter);
  const severityCards: Array<{ key: DiagnosticSeverity | 'all'; label: string; value: number; hint: string }> = [
    { key: 'all', label: 'All', value: scopedItems.length, hint: 'Rows after type and status filters' },
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
        <div className="diagnostic-controls" aria-label="Diagnostics row filters">
          <label>
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DiagnosticStatusFilter)}>
              <option value="unresolved">Unresolved</option>
              <option value="open">Open</option>
              <option value="awaiting_retry">Awaiting retry</option>
              <option value="manual_review">Manual review</option>
              <option value="closed">Closed</option>
              <option value="no_action_required">No action needed</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <div className="diagnostic-filter-summary">Showing {filteredItems.length} of {items.length} rows</div>
        </div>
        {filteredItems.length ? (
          <div className="diagnostic-table" role="table" aria-label="Diagnostics error summary">
            <div className="diagnostic-table-row diagnostic-table-head" role="row">
              <span>Ref</span>
              <span>Severity</span>
              <span>Error / status</span>
              <span>Occurred</span>
              <span>Codex Repair</span>
              <span>Handling</span>
            </div>
            {filteredItems.map((item) => {
              const errorNumber = diagnosticReference(item);
              const interventionStatus = item.agentInterventionStatus ? startCase(item.agentInterventionStatus) : 'Not involved';
              return (
              <div className={`diagnostic-table-row diagnostic-${item.severity}`} key={item.id} role="row">
                <code>{errorNumber}</code>
                <span>{diagnosticSeverityLabel(item.severity)}</span>
                <div className="diagnostic-table-main">
                  <strong>{item.title}</strong>
                  <small>{item.category} · {item.status} · {item.detail}</small>
                </div>
                <span>{item.occurredAt ? formatTimestamp(item.occurredAt) : 'Not recorded'}</span>
                <span>{interventionStatus}</span>
                <span>{handlingStatusLabel(item.handlingStatus)}</span>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-chart compact">No diagnostics match the selected filters.</div>
        )}
      </section>
    </>
  );
}

function temporalLaneSeverity(status?: string | null): string {
  if (status === 'populated' || status === 'regular' || status === 'crypto_continuous' || status === 'ready') return 'low';
  if (status === 'empty' || status === 'not_populated' || status === 'not_connected') return 'medium';
  if (status === 'missing' || status === 'unavailable' || status === 'driver_missing') return 'high';
  return 'info';
}

function eventForTick(events: TemporalExplorerEventPayload[], tick: TemporalExplorerTickPayload): TemporalExplorerEventPayload[] {
  const start = Date.parse(tick.tick_start_utc);
  const end = Date.parse(tick.tick_end_utc);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return events.filter((event) => {
    const at = Date.parse(event.event_time);
    return Number.isFinite(at) && at >= start && at < end;
  });
}

function frameMilliseconds(frame?: string | null): number {
  if (frame === '30m') return 30 * 60 * 1000;
  if (frame === '1h') return 60 * 60 * 1000;
  if (frame === '1W') return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function alignTemporalMilliseconds(value: number, frame?: string | null): number {
  if (!Number.isFinite(value)) return Date.now();
  const date = new Date(value);
  if (frame === '30m') {
    date.setUTCSeconds(0, 0);
    date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 30) * 30);
    return date.getTime();
  }
  if (frame === '1h') {
    date.setUTCMinutes(0, 0, 0);
    return date.getTime();
  }
  if (frame === '1W') {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.getTime();
  }
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function alignTemporalCenter(centerIso?: string | null, frame?: string | null): string {
  const parsed = Date.parse(centerIso ?? '');
  return new Date(alignTemporalMilliseconds(parsed, frame)).toISOString();
}

function chartTimeframeForFrame(frame?: string | null): string {
  if (frame === '30m') return '10min';
  if (frame === '1h') return '30min';
  if (frame === '1W') return '1W';
  return '1D';
}

function shiftTemporalCenter(centerIso?: string | null, frame?: string | null, offset = 0): string {
  const base = Date.parse(alignTemporalCenter(centerIso, frame));
  return new Date(base + frameMilliseconds(frame) * offset).toISOString();
}

function temporalTickLabel(value: Date, frame?: string | null): string {
  if (frame === '30m' || frame === '1h') {
    return value.toISOString().slice(5, 16).replace('T', ' ');
  }
  return value.toISOString().slice(0, 10);
}

function calendarInputDate(value?: string | null): string {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) return new Date().toISOString().slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

function buildTemporalTicks(
  centerIso: string | undefined,
  frame: string | undefined,
  sourceTicks: TemporalExplorerTickPayload[],
  events: TemporalExplorerEventPayload[],
): TemporalExplorerTickPayload[] {
  const parsedCenter = Date.parse(centerIso ?? '');
  if (!Number.isFinite(parsedCenter)) return sourceTicks;
  const delta = frameMilliseconds(frame);
  const alignedCenter = alignTemporalMilliseconds(parsedCenter, frame);
  const base = alignedCenter - delta * 10;
  const statusByDate = new Map(
    sourceTicks.map((tick) => [calendarInputDate(tick.tick_start_utc), tick.market_session_status ?? 'unknown']),
  );
  return Array.from({ length: 21 }, (_, index) => {
    const tickStart = new Date(base + delta * index);
    const tickEnd = new Date(tickStart.getTime() + delta);
    const shell = {
      tick_start_utc: tickStart.toISOString(),
      tick_end_utc: tickEnd.toISOString(),
      label: temporalTickLabel(tickStart, frame),
      is_center: index === 10,
      market_session_status: statusByDate.get(calendarInputDate(tickStart.toISOString())) ?? 'unknown',
      event_count: 0,
      chart_bar_count: 0,
    };
    return { ...shell, event_count: eventForTick(events, shell).length };
  });
}

function temporalPositionPercent(value?: string | null, start?: string | null, end?: string | null): number {
  const at = Date.parse(value ?? '');
  const startAt = Date.parse(start ?? '');
  const endAt = Date.parse(end ?? '');
  if (!Number.isFinite(at) || !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return 0;
  return Math.max(0, Math.min(100, ((at - startAt) / (endAt - startAt)) * 100));
}

type TemporalLightweightCandle = CandlestickData & {
  label: string;
  volume: number;
};

function temporalBarTime(bar: TemporalExplorerChartBarPayload): CandlestickData['time'] {
  const parsed = Date.parse(bar.bucket_start);
  return Math.floor((Number.isFinite(parsed) ? parsed : Date.now()) / 1000) as CandlestickData['time'];
}

function toTemporalLightweightCandle(bar: TemporalExplorerChartBarPayload): TemporalLightweightCandle {
  return {
    time: temporalBarTime(bar),
    label: formatTimestamp(bar.bucket_start),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume ?? 0,
  };
}

function isTemporalLightweightCandle(value: unknown): value is TemporalLightweightCandle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TemporalLightweightCandle>;
  return typeof candidate.label === 'string'
    && typeof candidate.open === 'number'
    && typeof candidate.high === 'number'
    && typeof candidate.low === 'number'
    && typeof candidate.close === 'number';
}

function TemporalTradingViewChart({
  symbol,
  timeframe,
  bars,
  events,
  viewportStart,
  viewportEnd,
}: {
  symbol: string;
  timeframe: string;
  bars: TemporalExplorerChartBarPayload[];
  events: TemporalExplorerEventPayload[];
  viewportStart: string;
  viewportEnd: string;
}) {
  const chartData = useMemo(() => bars.slice(-180).map(toTemporalLightweightCandle), [bars]);
  const volumeData = useMemo<HistogramData[]>(() => chartData.map((bar) => ({
    time: bar.time,
    value: bar.volume,
    color: bar.close >= bar.open ? 'rgba(34, 171, 148, .42)' : 'rgba(242, 54, 69, .42)',
  })), [chartData]);
  const candleByTime = useMemo(() => new Map(chartData.map((candle) => [chartTimeKey(candle.time), candle])), [chartData]);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<TemporalLightweightCandle | null>(null);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !chartData.length) return undefined;

    const chart: IChartApi = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1720' },
        textColor: '#8b9bb0',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, .10)' },
        horzLines: { color: 'rgba(148, 163, 184, .14)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(209, 213, 219, .48)', style: LineStyle.LargeDashed, labelVisible: false },
        horzLine: { color: 'rgba(209, 213, 219, .48)', style: LineStyle.LargeDashed, labelVisible: true },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, .18)',
        scaleMargins: { top: 0.06, bottom: 0.26 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, .18)',
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (price: number) => price.toFixed(2),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22ab94',
      downColor: '#f23645',
      borderUpColor: '#22ab94',
      borderDownColor: '#f23645',
      wickUpColor: '#22ab94',
      wickDownColor: '#f23645',
      priceLineVisible: true,
      lastValueVisible: true,
    });
    seriesRef.current = candleSeries;
    candleSeries.setData(chartData);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.setData(volumeData);
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.timeScale().fitContent();

    const handleCrosshairMove = (event: MouseEventParams) => {
      const item = seriesRef.current ? event.seriesData.get(seriesRef.current) : null;
      const timeMatch = event.time === undefined ? null : candleByTime.get(chartTimeKey(event.time));
      setHoveredCandle(timeMatch ?? (isTemporalLightweightCandle(item) ? item : null));
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      seriesRef.current = null;
      chart.remove();
    };
  }, [candleByTime, chartData, volumeData]);

  if (!chartData.length) {
    return <div className="empty-chart compact">{symbol} {timeframe} chart cache is empty for this viewport.</div>;
  }

  const latest = chartData[chartData.length - 1];
  const legend = hoveredCandle ?? latest;
  return (
    <div className="temporal-tradingview-shell">
      <div className="replay-lightweight-legend temporal-tradingview-legend">
        <strong>{symbol} · {timeframe}</strong>
        <span>{legend.label}</span>
        <span>O {legend.open.toFixed(2)}</span>
        <span>H {legend.high.toFixed(2)}</span>
        <span>L {legend.low.toFixed(2)}</span>
        <span>C {legend.close.toFixed(2)}</span>
        <span>V {legend.volume.toFixed(0)}</span>
      </div>
      <div ref={chartRef} className="temporal-tradingview-chart" role="img" aria-label={`${symbol} ${timeframe} TradingView style chart`} />
      <div className="event-marker-layer temporal-tradingview-events" aria-hidden="true">
        {events.slice(0, 160).map((event) => (
          <span
            className="event-axis-marker"
            key={`${event.lane}-${event.event_id}`}
            style={{ left: `${temporalPositionPercent(event.event_time, viewportStart, viewportEnd)}%` }}
            title={`${formatTimestamp(event.event_time)} · ${event.title}`}
          />
        ))}
      </div>
    </div>
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
  if (view === 'events') return TEMPORAL_EXPLORER_SUMMARY;
  if (view === 'realtime') return REALTIME_SIGNAL_SUMMARY;
  if (view === 'models') return MODEL_READINESS;
  if (view === 'replay' || view === 'performance' || view === 'decisions') return MODEL_GROUP_REPLAY_REVIEW;
  return HISTORICAL_TASK_PROGRESS;
}

function App() {
  const [currentStatusModel, setCurrentStatusModel] = useState<DashboardReadModel | null>(null);
  const [historicalModel, setHistoricalModel] = useState<DashboardReadModel | null>(null);
  const [realtimeModel, setRealtimeModel] = useState<DashboardReadModel | null>(null);
  const [temporalExplorerModel, setTemporalExplorerModel] = useState<DashboardReadModel | null>(null);
  const [modelLayerModel, setModelLayerModel] = useState<DashboardReadModel | null>(null);
  const [modelPromotionModel, setModelPromotionModel] = useState<DashboardReadModel | null>(null);
  const [replayReviewModel, setReplayReviewModel] = useState<DashboardReadModel | null>(null);
  const [executionRuntimeModel, setExecutionRuntimeModel] = useState<DashboardReadModel | null>(null);
  const [readModelErrors, setReadModelErrors] = useState<Record<string, string>>({});
  const [loadingContracts, setLoadingContracts] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<ViewId>('status');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<ReadModelStreamStatus>('connecting');
  const [selectedTemporalFrame, setSelectedTemporalFrame] = useState<string | null>(null);
  const [selectedTemporalSymbol, setSelectedTemporalSymbol] = useState<string | null>(null);
  const [selectedTemporalCenter, setSelectedTemporalCenter] = useState<string | null>(null);

  const applyReadModel = useCallback((payload: DashboardReadModel) => {
    if (payload.contract_type === CURRENT_SYSTEM_STATUS) setCurrentStatusModel(payload);
    if (payload.contract_type === HISTORICAL_TASK_PROGRESS) setHistoricalModel(payload);
    if (payload.contract_type === REALTIME_SIGNAL_SUMMARY) setRealtimeModel(payload);
    if (payload.contract_type === TEMPORAL_EXPLORER_SUMMARY) setTemporalExplorerModel(payload);
    if (payload.contract_type === MODEL_READINESS) setModelLayerModel(payload);
    if (payload.contract_type === MODEL_PROMOTION_POSTURE) setModelPromotionModel(payload);
    if (payload.contract_type === MODEL_GROUP_REPLAY_REVIEW) setReplayReviewModel(payload);
    if (payload.contract_type === EXECUTION_RUNTIME_STATUS) setExecutionRuntimeModel(payload);
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

  const loadOptionalReadModel = useCallback((contractType: string, signal?: AbortSignal) => (
    fetchLatestReadModel(contractType, signal)
      .then(applyReadModel)
      .catch((problem: Error) => {
        if (problem.name === 'AbortError' || signal?.aborted) return;
        setReadModelErrors((previous) => {
          const next = { ...previous };
          delete next[contractType];
          return next;
        });
      })
  ), [applyReadModel]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReadModel(CURRENT_SYSTEM_STATUS, controller.signal);
    void loadReadModel(TEMPORAL_EXPLORER_SUMMARY, controller.signal);
    void loadReadModel(HISTORICAL_TASK_PROGRESS, controller.signal);
    void loadReadModel(REALTIME_SIGNAL_SUMMARY, controller.signal);
    void loadReadModel(EXECUTION_RUNTIME_STATUS, controller.signal);
    void loadOptionalReadModel(MODEL_READINESS, controller.signal);
    void loadOptionalReadModel(MODEL_PROMOTION_POSTURE, controller.signal);
    void loadOptionalReadModel(MODEL_GROUP_REPLAY_REVIEW, controller.signal);
    const liveContracts = new Set<string>();
    const contracts = [CURRENT_SYSTEM_STATUS, TEMPORAL_EXPLORER_SUMMARY, HISTORICAL_TASK_PROGRESS, REALTIME_SIGNAL_SUMMARY, EXECUTION_RUNTIME_STATUS];
    const optionalContracts = [MODEL_READINESS, MODEL_PROMOTION_POSTURE, MODEL_GROUP_REPLAY_REVIEW];
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
    const optionalSockets = optionalContracts.map((contractType) => openLatestReadModelSocket(contractType, {
      onSnapshot: applyReadModel,
      onStatus: setStreamStatus,
      onError: () => undefined,
    }));
    const fallbackIntervalId = window.setInterval(() => {
      sockets.forEach((socket, index) => {
        if (socket.readyState !== WebSocket.OPEN && contracts[index] !== HISTORICAL_TASK_PROGRESS) void loadReadModel(contracts[index]);
      });
      optionalSockets.forEach((socket, index) => {
        if (socket.readyState !== WebSocket.OPEN) void loadOptionalReadModel(optionalContracts[index]);
      });
    }, 10_000);
    const historicalProgressIntervalId = window.setInterval(() => {
      void loadReadModel(HISTORICAL_TASK_PROGRESS);
    }, 2_000);
    return () => {
      controller.abort();
      sockets.forEach((socket) => socket.close());
      optionalSockets.forEach((socket) => socket.close());
      window.clearInterval(fallbackIntervalId);
      window.clearInterval(historicalProgressIntervalId);
    };
  }, [applyReadModel, loadOptionalReadModel, loadReadModel]);

  const activeContractType = contractForView(activeView);
  const activeReadModel = activeView === 'status' || activeView === 'data'
    ? currentStatusModel
    : activeView === 'events'
      ? temporalExplorerModel
    : activeView === 'realtime'
      ? realtimeModel
    : activeView === 'models'
      ? modelLayerModel ?? historicalModel
    : activeView === 'replay' || activeView === 'performance' || activeView === 'decisions'
      ? replayReviewModel ?? modelPromotionModel ?? historicalModel
      : historicalModel;
  const pageStatusModel = currentStatusModel ?? activeReadModel;
  const activeError = activeReadModel ? null : (readModelErrors[activeContractType] ?? null);
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
  const temporalExplorerChart = useMemo(() => {
    if (!temporalExplorerModel || !isTemporalExplorerChart(temporalExplorerModel.chart_payload)) return {} as TemporalExplorerChartPayload;
    return temporalExplorerModel.chart_payload;
  }, [temporalExplorerModel]);
  const modelLayerChart = useMemo(() => {
    if (!modelLayerModel || !isModelLayerReadinessChart(modelLayerModel.chart_payload)) return {} as ModelLayerReadinessChartPayload;
    return modelLayerModel.chart_payload;
  }, [modelLayerModel]);
  const modelPromotionChart = useMemo(() => {
    if (!modelPromotionModel || !isModelPromotionPostureChart(modelPromotionModel.chart_payload)) return {} as ModelPromotionPostureChartPayload;
    return modelPromotionModel.chart_payload;
  }, [modelPromotionModel]);
  const executionRuntimeChart = useMemo(() => {
    if (!executionRuntimeModel || !isExecutionRuntimeChart(executionRuntimeModel.chart_payload)) return {} as ExecutionRuntimeStatusChartPayload;
    return executionRuntimeModel.chart_payload;
  }, [executionRuntimeModel]);
  const replayReviewChart = useMemo(() => {
    if (!replayReviewModel || !isReplayReviewChart(replayReviewModel.chart_payload)) return {} as ReplayReviewChartPayload;
    return replayReviewModel.chart_payload;
  }, [replayReviewModel]);

  useEffect(() => {
    const viewport = temporalExplorerChart.viewport ?? {};
    const chartModel = temporalExplorerChart.chart ?? {};
    setSelectedTemporalFrame((previous) => previous ?? viewport.frame ?? '1D');
    setSelectedTemporalSymbol((previous) => previous ?? chartModel.symbol ?? chartModel.available_symbols?.[0] ?? 'SPY');
    setSelectedTemporalCenter((previous) => previous ?? viewport.center_time_utc ?? temporalExplorerModel?.generated_at_utc ?? new Date().toISOString());
  }, [temporalExplorerChart, temporalExplorerModel?.generated_at_utc]);
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
    const foldStep = runtime.fold_step_month_count;
    return (
      <section className="panel runtime-throughput-panel">
        <div className="panel-heading">Runtime Throughput</div>
        <p className="panel-subtitle">{runtime.summary ?? 'Historical scheduler throughput has not been observed yet.'}</p>
        <div className="artifact-grid runtime-throughput-grid">
          <MetricCard label="Runtime lanes" value={`${monthWorkers}+${modelWorkers}`} hint={`${runtime.total_worker_count ?? monthWorkers + modelWorkers} total workers`} />
          <MetricCard label="Fold window" value={`${runtime.fold_month_count ?? 18} months`} hint={rounds ? `${rounds} ingest rounds, ${foldStep ?? 12}-month step` : `${foldStep ?? 12}-month step`} />
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

  const renderEventsView = () => {
    if (!temporalExplorerModel) {
      return <section className="panel loading-panel">Loading event timeline…</section>;
    }
    const viewport = temporalExplorerChart.viewport ?? {};
    const activeFrame = selectedTemporalFrame ?? viewport.frame ?? '1D';
    const activeCenter = alignTemporalCenter(selectedTemporalCenter ?? viewport.center_time_utc ?? temporalExplorerModel.generated_at_utc, activeFrame);
    const viewportStart = shiftTemporalCenter(activeCenter, activeFrame, -10);
    const viewportEnd = shiftTemporalCenter(activeCenter, activeFrame, 11);
    const events = temporalExplorerChart.events ?? [];
    const chartModel = temporalExplorerChart.chart ?? {};
    const availableSymbols = chartModel.available_symbols?.length ? chartModel.available_symbols : [chartModel.symbol ?? 'SPY', 'QQQ', 'IWM', 'DIA'];
    const activeSymbol = selectedTemporalSymbol ?? availableSymbols[0] ?? 'SPY';
    const activeChartTimeframe = chartTimeframeForFrame(activeFrame);
    const chartBars = (chartModel.bars ?? []).filter((bar) => (
      bar.symbol === activeSymbol && bar.timeframe === activeChartTimeframe
    ));
    const ticks = buildTemporalTicks(activeCenter, activeFrame, temporalExplorerChart.timewheel_ticks ?? [], events);
    const selectedTick = ticks.find((tick) => tick.is_center) ?? ticks[10] ?? ticks[0];
    const selectedTickEvents = selectedTick ? eventForTick(events, selectedTick) : [];
    const rightLanes = temporalExplorerChart.right_lanes ?? [];
    const substrate = temporalExplorerChart.substrate_status ?? {};
    const volumeValues = chartBars.map((bar) => bar.volume ?? 0).filter((value) => Number.isFinite(value));
    const maxVolume = Math.max(...volumeValues, 1);
    const maxTickEvents = Math.max(...ticks.map((tick) => tick.event_count ?? 0), 1);
    const shiftCenter = (offset: number) => setSelectedTemporalCenter((current) => shiftTemporalCenter(current ?? activeCenter, activeFrame, offset));
    return (
      <>
        <section className="panel temporal-substrate-panel">
          <div className="panel-heading">Event Timeline Substrate</div>
          <div className="temporal-substrate-grid">
            {rightLanes.map((lane) => (
              <section className="temporal-substrate-card" key={lane.lane_id} title={`${lane.label}: ${startCase(lane.status)}`}>
                <div>
                  <span>{lane.label}</span>
                  <strong>{lane.item_count}</strong>
                </div>
                <StatusPill status={lane.status} severity={temporalLaneSeverity(lane.status)} />
              </section>
            ))}
          </div>
        </section>

        <section className="panel timewheel-chart-panel integrated-timewheel">
          <div className="timewheel-chart-head">
            <div>
              <div className="panel-heading">Event Timeline</div>
              <p className="panel-subtitle">{chartModel.role ? startCase(chartModel.role) : 'Chart cache is a visualization substrate, not training truth.'}</p>
            </div>
            <div className="temporal-chart-controls">
              <label className="temporal-control">
                Symbol
                <select value={activeSymbol} onChange={(event) => setSelectedTemporalSymbol(event.currentTarget.value)}>
                  {availableSymbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                </select>
              </label>
              <label className="temporal-control">
                Center
                <input
                  type="datetime-local"
                  value={activeCenter.slice(0, 16)}
                  onChange={(event) => setSelectedTemporalCenter(alignTemporalCenter(`${event.currentTarget.value}:00Z`, activeFrame))}
                />
              </label>
              <div className="frame-switcher">
                {(viewport.available_frames ?? ['30m', '1h', '1D', '1W']).map((frame) => (
                  <button
                    className={frame === activeFrame ? 'selected' : ''}
                    key={frame}
                    onClick={() => setSelectedTemporalFrame(frame)}
                    type="button"
                  >
                    {frame}
                  </button>
                ))}
              </div>
              <div className="axis-nudge-controls">
                <button type="button" onClick={() => shiftCenter(-1)}>Prev</button>
                <button type="button" onClick={() => shiftCenter(1)}>Next</button>
              </div>
            </div>
          </div>
          <div
            className="temporal-chart-frame"
            onWheel={(event) => {
              if (Math.abs(event.deltaY) < 8) return;
              event.preventDefault();
              shiftCenter(event.deltaY > 0 ? 1 : -1);
            }}
          >
            <TemporalTradingViewChart
              symbol={activeSymbol}
              timeframe={activeChartTimeframe}
              bars={chartBars}
              events={events}
              viewportStart={viewportStart}
              viewportEnd={viewportEnd}
            />
            <div className="timeline-x-axis">
              {ticks.map((tick) => (
                <button
                  className={tick.is_center ? 'timeline-axis-tick selected' : 'timeline-axis-tick'}
                  key={tick.tick_start_utc}
                  onClick={() => setSelectedTemporalCenter(tick.tick_start_utc)}
                  type="button"
                >
                  <span />
                  <strong>{tick.label}</strong>
                  <small>{startCase(tick.market_session_status)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="subchart-grid">
            <section className="subchart-panel">
              <div className="subchart-heading">Volume</div>
              {chartBars.length ? (
                <div className="volume-subchart">
                  {chartBars.slice(-90).map((bar) => (
                    <span
                      key={`${bar.symbol}-${bar.timeframe}-${bar.bucket_start}-volume`}
                      style={{ height: `${Math.max(((bar.volume ?? 0) / maxVolume) * 100, 2)}%` }}
                      title={`${formatTimestamp(bar.bucket_start)} · volume ${bar.volume ?? 0}`}
                    />
                  ))}
                </div>
            ) : (
                <div className="empty-subchart">Waiting for {activeSymbol} {activeChartTimeframe} bars.</div>
              )}
            </section>
            <section className="subchart-panel">
              <div className="subchart-heading">Accepted Event Density</div>
              <div className="event-density-subchart">
                {ticks.map((tick) => (
                  <span
                    key={`${tick.tick_start_utc}-density`}
                    style={{ height: `${Math.max(((tick.event_count ?? 0) / maxTickEvents) * 100, tick.event_count ? 8 : 2)}%` }}
                    title={`${tick.label} · ${tick.event_count ?? 0} events`}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
        <section className="panel temporal-events-panel">
          <div className="panel-heading">Event Markers</div>
          <p className="panel-subtitle">Showing only the selected {activeFrame} unit. Markers require M06 accepted event-family status.</p>
          {selectedTickEvents.length ? (
            <div className="temporal-event-stack">
              {selectedTickEvents.map((event) => (
                <article className="temporal-event-card detailed" key={`${event.lane}-${event.event_id}`}>
                  <strong>{event.title}</strong>
                  <small>
                    {startCase(event.event_type)}
                    {event.scope ? ` · ${startCase(event.scope)}` : ''}
                    {event.symbol ? ` · ${event.symbol}` : ''}
                    {event.source_name ? ` · ${startCase(event.source_name)}` : ''}
                  </small>
                  {event.summary ? <p>{event.summary}</p> : null}
                  {event.reference ? <small>{startCase(event.reference_type)} · {event.reference}</small> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-chart compact">No M06 accepted event markers for {selectedTick?.label ?? 'the selected time unit'}.</div>
          )}
        </section>
        <ReplayEventsView replayReviewChart={replayReviewChart} />
      </>
    );
  };

  const renderMainView = () => {
    if (activeView === 'status') return renderCurrentStatusView();
    if (activeView === 'events') return renderEventsView();
    if (activeView === 'data') return <DataExplorerView />;
    if (activeView === 'performance') return <ReplayPerformanceView promotionChart={modelPromotionChart} replayReviewChart={replayReviewChart} />;
    if (activeView === 'decisions') return <ReplayDecisionsView promotionChart={modelPromotionChart} replayReviewChart={replayReviewChart} />;
    if (activeView === 'replay') return <ReplayOperationsView promotionChart={modelPromotionChart} replayReviewChart={replayReviewChart} />;
    if (!historicalModel) return null;
    if (activeView === 'diagnostics') {
      return <DiagnosticsSummaryView items={diagnosticItems} currentStatusModel={currentStatusModel} historicalModel={historicalModel} />;
    }
    if (activeView === 'tasks') {
      return <TaskTimelineList tasks={chart.task_timeline ?? []} />;
    }
    if (activeView === 'models') {
      return (
        <ModelGroupDetail
          layerChart={modelLayerChart}
          promotionChart={modelPromotionChart}
          runtimeChart={executionRuntimeChart}
        />
      );
    }
    if (activeView === 'registry') return <PlaceholderView title="Definitions" />;
    if (activeView === 'realtime') return renderRealtimeSignalsView();
    return (
      <>
        <section className="metric-grid">
          <MetricCard label="Active historical period" value={chart.current_month ?? 'Unknown'} />
          <MetricCard label="Runtime work" value={runtimeWorkLabel(chart)} hint={runtimeWorkHint(chart)} />
          <MetricCard
            label="Active task"
            value={activeTaskLabel(chart)}
            hint={chart.active_task?.status ? `${startCase(chart.active_task.status)} · ${chart.active_task.month ?? 'unknown period'}` : undefined}
          />
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

  const pageTitle = activeView === 'status' ? 'Status' : activeView === 'data' ? 'Data' : activeView === 'events' ? 'Events' : activeView === 'performance' ? 'Replay Performance' : activeView === 'decisions' ? 'Replay Decisions' : activeView === 'replay' ? 'Replay Operations' : startCase(activeView);
  const pageEyebrow = activeView === 'status' ? 'System / Status' : activeView === 'data' ? 'Data + Model Outputs / Dashboard' : activeView === 'events' ? 'Historical Events / Timeline + Replay Review' : activeView === 'performance' ? 'Historical Replay / Performance' : activeView === 'decisions' ? 'Historical Replay / Decisions' : activeView === 'replay' ? 'Historical Replay / Operations' : `${startCase(activeView)} / Dashboard`;

  const refreshAll = () => {
    void loadReadModel(CURRENT_SYSTEM_STATUS);
    void loadReadModel(HISTORICAL_TASK_PROGRESS);
    void loadReadModel(TEMPORAL_EXPLORER_SUMMARY);
    void loadReadModel(REALTIME_SIGNAL_SUMMARY);
    void loadReadModel(EXECUTION_RUNTIME_STATUS);
    void loadOptionalReadModel(MODEL_READINESS);
    void loadOptionalReadModel(MODEL_PROMOTION_POSTURE);
    void loadOptionalReadModel(MODEL_GROUP_REPLAY_REVIEW);
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
          {navSections.map((section) => (
            <section className="nav-section" key={section.label} aria-label={`${section.label} navigation`}>
              <div className="nav-section-title">{section.label}</div>
              <div className="nav-section-items">
                {section.items.map((item) => (
                  <button className={`nav-item ${activeView === item.id ? 'active' : ''}`} key={item.id} type="button" onClick={() => setActiveView(item.id)}>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
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
