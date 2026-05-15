import { useCallback, useEffect, useMemo, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StatusPill } from './components';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel, openLatestReadModelSocket, type ReadModelStreamStatus } from './readModels';
import type { CurrentSystemStatusChartPayload, DashboardReadModel, HistoricalTaskProgressChartPayload, HistoricalTaskTimelineItemPayload } from './types';
import './styles.css';

const CURRENT_SYSTEM_STATUS = 'current_system_status_summary';
const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary';

const SOURCE_LABELS: Record<string, string> = {
  'trading-storage': 'System Monitor',
  'trading-manager': 'Task Manager',
};

const SERVICE_LABELS: Record<string, string> = {
  'trading-manager-historical-scheduler.service': 'Historical Training Automation',
  'trading-storage-dashboard-read-model-refresh.timer': 'Dashboard Refresh Schedule',
  'trading-storage-dashboard-read-model-refresh.service': 'Dashboard Refresh Worker',
};

type ViewId = 'status' | 'tasks' | 'diagnostics' | 'models' | 'registry' | 'realtime' | 'performance';

const navItems: Array<{ id: ViewId; label: string; state: string }> = [
  { id: 'status', label: 'Current Status', state: 'Live' },
  { id: 'tasks', label: 'Tasks', state: 'Task list' },
  { id: 'diagnostics', label: 'Diagnostics', state: 'Details' },
  { id: 'models', label: 'Models', state: 'Historical modeling' },
  { id: 'registry', label: 'Definitions', state: 'Coming soon' },
  { id: 'realtime', label: 'Realtime Signals', state: 'Coming soon' },
  { id: 'performance', label: 'Trading Performance', state: 'Coming soon' },
];

function isHistoricalChart(payload: DashboardReadModel['chart_payload']): payload is HistoricalTaskProgressChartPayload {
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
  return SERVICE_LABELS[unit] ?? startCase(unit.replace(/\.service$|\.timer$/u, ''));
}

function apiStatusLabel(status?: string | null): string {
  if (status === 'connected') return 'Connected';
  if (status === 'configured') return 'Configured';
  if (status === 'not_configured') return 'Not configured';
  if (status === 'local_service_online') return 'Local service online';
  if (status === 'local_service_offline') return 'Local service offline';
  return startCase(status);
}

function apiIsHealthy(status?: string | null): boolean {
  return status === 'connected' || status === 'configured' || status === 'available' || status === 'local_service_online';
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


function sanitizedRefSummary(ref: unknown): string {
  if (typeof ref !== 'object' || ref === null) return String(ref);
  const record = ref as Record<string, unknown>;
  const parts: string[] = [];
  if ('status' in record) parts.push(`Status: ${startCase(String(record.status))}`);
  if ('generated_at_utc' in record) parts.push(`Generated: ${formatTimestamp(String(record.generated_at_utc))}`);
  if ('source_system' in record) parts.push(`Source: ${publicSourceLabel(String(record.source_system))}`);
  return parts.length ? parts.join(' · ') : 'Reference available for diagnostics.';
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
  const normalized = Number(value.replace(/-/gu, ''));
  return Number.isFinite(normalized) ? normalized : Number.MAX_SAFE_INTEGER - 1;
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
            <strong>{formatPercent(progressPercent)} · {progress.ready_count ?? 0}/{progress.expected_count ?? 0} ready</strong>
            <div className="mini-progress" aria-label={`Task progress ${formatPercent(progressPercent)}`}>
              <div className="mini-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <small>Pending {progress.pending_count ?? 0} · Failed {progress.failed_count ?? 0} · Accepted skips {progress.accepted_failed_count ?? 0}</small>
          </div>
        ) : task.task_state === 'current' ? (
          <div className="task-detail-card wide-detail">
            <span>Current progress</span>
            <strong>{fallbackProgress.label}</strong>
            <div className="mini-progress" aria-label={`Task progress ${fallbackProgress.label}`}>
              <div className="mini-progress-fill" style={{ width: `${fallbackProgressPercent}%` }} />
            </div>
            <small>{fallbackProgress.hint}</small>
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

function TaskTimelineList({ tasks }: { tasks: HistoricalTaskTimelineItemPayload[] }) {
  const [monthFilter, setMonthFilter] = useState('all');
  const [layerFilter, setLayerFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('current');
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
    () => uniqueTaskOptions(tasks, taskTargetFilterValue, taskTargetLabel),
    [tasks],
  );
  const filteredTasks = useMemo(
    () => tasks.filter((task) => {
      if (monthFilter !== 'all' && taskMonthFilterValue(task) !== monthFilter) return false;
      if (layerFilter !== 'all' && taskLayerFilterValue(task) !== layerFilter) return false;
      if (stateFilter !== 'all' && task.task_state !== stateFilter) return false;
      if (workTypeFilter !== 'all' && taskWorkTypeFilterValue(task) !== workTypeFilter) return false;
      if (workerFilter !== 'all' && taskWorkerFilterValue(task) !== workerFilter) return false;
      if (targetFilter !== 'all' && taskTargetFilterValue(task) !== targetFilter) return false;
      return true;
    }),
    [layerFilter, monthFilter, stateFilter, targetFilter, tasks, workerFilter, workTypeFilter],
  );
  const monthGroups = useMemo(() => groupTasksByMonth(filteredTasks), [filteredTasks]);

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
        <button className="secondary-button" type="button" onClick={() => { setMonthFilter('all'); setLayerFilter('all'); setStateFilter('current'); setWorkTypeFilter('all'); setWorkerFilter('all'); setTargetFilter('all'); setExpandedTasks(new Set()); }}>
          Reset to Now
        </button>
      </div>
      <div className="task-filters" aria-label="Task list filters">
        <label>
          <span>Month</span>
          <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
            <option value="all">All months</option>
            {monthOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Layer</span>
          <select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)}>
            <option value="all">All layers</option>
            {layerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {stateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
          <span>Worker</span>
          <select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}>
            <option value="all">All workers</option>
            {workerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Target</span>
          <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
            <option value="all">All targets</option>
            {targetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {monthGroups.length ? (
        <div className="task-month-groups">
          {monthGroups.map(([month, monthTasks]) => (
            <section className="task-month-group" key={month}>
              <div className="task-month-heading">
                <strong>{month}</strong>
                <span>{monthTasks.length} child tasks</span>
              </div>
              <div className="task-list" role="list">
                {monthTasks.map((task) => {
                  const taskKey = `${task.month ?? 'unknown'}-${task.sequence}-${task.task_id}`;
                  const isExpanded = expandedTasks.has(taskKey);
                  return (
                    <article className={`task-row task-${task.task_state}`} key={taskKey} role="listitem">
                      <div className="task-index">{task.sequence}</div>
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
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-chart compact">No tasks match the selected filters.</div>
      )}
    </section>
  );
}

function RefPanel({ title, refs }: { title: string; refs: unknown[] }) {
  const [selected, setSelected] = useState<number | null>(refs.length ? 0 : null);
  return (
    <section className="panel interactive-panel">
      <div className="panel-heading">{title}</div>
      {refs.length ? (
        <>
          <div className="click-list">
            {refs.map((ref, index) => (
              <button
                className={`click-row ${selected === index ? 'selected' : ''}`}
                key={index}
                type="button"
                onClick={() => setSelected(index)}
              >
                <span>{safeRefLabel(ref, `${title} ${index + 1}`)}</span>
                <small>Open details</small>
              </button>
            ))}
          </div>
          {selected !== null ? <p className="ref-summary">{sanitizedRefSummary(refs[selected])}</p> : null}
        </>
      ) : (
        <div className="empty-chart compact">No {title.toLowerCase()} attached.</div>
      )}
    </section>
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

function App() {
  const [currentStatusModel, setCurrentStatusModel] = useState<DashboardReadModel | null>(null);
  const [historicalModel, setHistoricalModel] = useState<DashboardReadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewId>('status');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<ReadModelStreamStatus>('connecting');

  const applyReadModel = useCallback((payload: DashboardReadModel) => {
    if (payload.contract_type === CURRENT_SYSTEM_STATUS) setCurrentStatusModel(payload);
    if (payload.contract_type === HISTORICAL_TASK_PROGRESS) setHistoricalModel(payload);
    setError(null);
    setLastRefresh(new Date().toISOString());
  }, []);

  const loadReadModel = useCallback((contractType: string, signal?: AbortSignal) => {
    setLoading(true);
    return fetchLatestReadModel(contractType, signal)
      .then(applyReadModel)
      .catch((problem: Error) => {
        if (problem.name === 'AbortError' || signal?.aborted) return;
        setError(problem.message);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [applyReadModel]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReadModel(CURRENT_SYSTEM_STATUS, controller.signal);
    void loadReadModel(HISTORICAL_TASK_PROGRESS, controller.signal);
    let hasLivePayload = false;
    const sockets = [CURRENT_SYSTEM_STATUS, HISTORICAL_TASK_PROGRESS].map((contractType) => openLatestReadModelSocket(contractType, {
      onSnapshot: (payload) => {
        hasLivePayload = true;
        applyReadModel(payload);
        setLoading(false);
      },
      onStatus: setStreamStatus,
      onError: (message) => {
        if (!hasLivePayload) setError(message);
      },
    }));
    const fallbackIntervalId = window.setInterval(() => {
      sockets.forEach((socket, index) => {
        if (socket.readyState !== WebSocket.OPEN) void loadReadModel(index === 0 ? CURRENT_SYSTEM_STATUS : HISTORICAL_TASK_PROGRESS);
      });
    }, 60_000);
    return () => {
      controller.abort();
      sockets.forEach((socket) => socket.close());
      window.clearInterval(fallbackIntervalId);
    };
  }, [applyReadModel, loadReadModel]);

  const activeReadModel = activeView === 'status' ? currentStatusModel : historicalModel;
  const pageStatusModel = currentStatusModel ?? activeReadModel;
  const chart = useMemo(() => {
    if (!historicalModel || !isHistoricalChart(historicalModel.chart_payload)) return {} as HistoricalTaskProgressChartPayload;
    return historicalModel.chart_payload;
  }, [historicalModel]);
  const systemChart = useMemo(() => {
    if (!currentStatusModel || typeof currentStatusModel.chart_payload !== 'object' || Array.isArray(currentStatusModel.chart_payload)) return {} as CurrentSystemStatusChartPayload;
    return currentStatusModel.chart_payload as CurrentSystemStatusChartPayload;
  }, [currentStatusModel]);

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
    const sourceOutputs = systemChart.source_outputs ?? [];
    const apis = systemChart.apis ?? [];
    return (
      <>
        {renderServerResourcesPanel()}
        {renderThreadingPanel()}
        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">API Connections</div>
            <div className="service-list">
              {apis.map((api) => {
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
              {services.map((service) => (
                <div className="service-row" key={service.unit}>
                  <span>{publicServiceLabel(service.unit)}</span>
                  <strong className={service.healthy ? 'service-ok' : 'service-warn'}>{service.healthy ? 'Healthy' : startCase(service.active_state)}</strong>
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

  const renderMainView = () => {
    if (activeView === 'status') return renderCurrentStatusView();
    if (!historicalModel) return null;
    if (activeView === 'diagnostics') {
      return (
        <section className="diagnostic-grid">
          <RefPanel title="Diagnostic Refs" refs={historicalModel.diagnostic_refs} />
          <RefPanel title="Issue Refs" refs={historicalModel.issue_refs} />
          <RefPanel title="Lineage Refs" refs={historicalModel.lineage_refs} />
          <RefPanel title="Profile Refs" refs={historicalModel.profile_refs} />
        </section>
      );
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
    if (activeView === 'realtime') return <PlaceholderView title="Realtime Signals" />;
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

  const pageTitle = activeView === 'status' ? 'Current Status' : startCase(activeView);
  const pageEyebrow = activeView === 'status' ? 'System / Status' : `${startCase(activeView)} / Dashboard`;

  const refreshAll = () => {
    void loadReadModel(CURRENT_SYSTEM_STATUS);
    void loadReadModel(HISTORICAL_TASK_PROGRESS);
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
            <button className="primary-action compact-action" type="button" onClick={refreshAll} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
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

        {error ? (
          <section className="panel error-panel">
            <div className="panel-heading">Dashboard data unavailable</div>
            <p>{error}</p>
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
