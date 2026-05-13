import { useCallback, useEffect, useMemo, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StageStackedBar, StatusPill } from './components';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel, openLatestReadModelSocket, type ReadModelStreamStatus } from './readModels';
import type { CurrentSystemStatusChartPayload, DashboardReadModel, HistoricalTaskProgressChartPayload } from './types';
import './styles.css';

const CURRENT_SYSTEM_STATUS = 'current_system_status_summary';
const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary';

const SUMMARY_LABELS: Record<string, string> = {
  [CURRENT_SYSTEM_STATUS]: 'System Health Summary',
  [HISTORICAL_TASK_PROGRESS]: 'Task Progress Summary',
};

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
  { id: 'tasks', label: 'Tasks', state: 'Training progress' },
  { id: 'diagnostics', label: 'Diagnostics', state: 'Details' },
  { id: 'models', label: 'Models', state: 'Coming soon' },
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

function publicSummaryLabel(contractType?: string | null): string {
  if (!contractType) return 'Dashboard Summary';
  return SUMMARY_LABELS[contractType] ?? startCase(contractType);
}

function publicSourceLabel(sourceSystem?: string | null): string {
  if (!sourceSystem) return 'Dashboard System';
  return SOURCE_LABELS[sourceSystem] ?? startCase(sourceSystem);
}

function publicServiceLabel(unit?: string | null): string {
  if (!unit) return 'System Service';
  return SERVICE_LABELS[unit] ?? startCase(unit.replace(/\.service$|\.timer$/u, ''));
}

function formatAgeSeconds(ageSeconds?: number | null): string {
  if (typeof ageSeconds !== 'number' || !Number.isFinite(ageSeconds)) return 'age unknown';
  if (ageSeconds < 60) return `${Math.round(ageSeconds)}s ago`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m ago`;
  return `${Math.round(ageSeconds / 3600)}h ago`;
}

function formatPercent(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : '0.0%';
}

function formatNetworkRate(kbps?: number | null): string {
  if (typeof kbps !== 'number' || !Number.isFinite(kbps)) return '0 KB/s';
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
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
          <MetricCard label="Storage" value={`${server.storage_available_gb ?? 0} GB`} hint={`Total ${server.storage_total_gb ?? 0} GB`} />
          <MetricCard label="Download" value={formatNetworkRate(server.network_download_kbps)} />
          <MetricCard label="Upload" value={formatNetworkRate(server.network_upload_kbps)} />
          <MetricCard label="Uptime" value={`${Math.round((server.uptime_seconds ?? 0) / 3600)}h`} />
        </div>
      </section>
    );
  };

  const renderCurrentStatusView = () => {
    const services = systemChart.services ?? [];
    const readModels = systemChart.read_models ?? [];
    return (
      <>
        <section className="metric-grid two">
          <MetricCard label="Server" value="Online" hint="Running normally" />
          <MetricCard label="Auto Refresh" value={`${systemChart.refresh?.cadence_seconds ?? 0}s`} hint={systemChart.refresh?.status === 'active' ? 'Refresh schedule active' : startCase(systemChart.refresh?.status)} />
        </section>
        <section className="detail-grid">
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
          <section className="panel">
            <div className="panel-heading">Dashboard Data</div>
            <div className="service-list">
              {readModels.map((model) => (
                <div className="service-row" key={model.contract_type}>
                  <span>{publicSummaryLabel(model.contract_type)}</span>
                  <strong className={model.status === 'fresh' ? 'service-ok' : 'service-warn'}>{startCase(model.status)} · {formatAgeSeconds(model.age_seconds)}</strong>
                </div>
              ))}
            </div>
          </section>
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
      return (
        <>
          <section className="metric-grid three">
            <MetricCard label="Current month" value={chart.current_month ?? 'Unknown'} />
            <MetricCard label="Active stage" value={startCase(chart.active_stage)} />
            <MetricCard label="Next action" value={startCase(chart.next_expected_system_action)} />
          </section>
          <HistoricalProgressVisual chart={chart} />
          <section className="panel">
            <div className="panel-heading">Stage Counts</div>
            <StageStackedBar counts={chart.stage_counts} />
          </section>
        </>
      );
    }
    if (activeView === 'models') return <PlaceholderView title="Models" />;
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
            <div className="panel-heading">Next Expected System Action</div>
            <p className="next-action">{startCase(chart.next_expected_system_action)}</p>
            <div className="muted">Blocker: {startCase(chart.blocker_category)}</div>
          </section>
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

  const pageTitle = activeView === 'status' ? 'Current Status' : 'Historical Task Progress';
  const pageEyebrow = activeView === 'status' ? 'System / Status' : `${startCase(activeView)} / Historical Modeling`;

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

        {activeView === 'status' && currentStatusModel ? renderServerResourcesPanel() : null}

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
            {activeView !== 'status' ? (
              <section className="summary-card">
                <div>
                  <div className="eyebrow">{publicSummaryLabel(activeReadModel.contract_type)}</div>
                  <h2>{activeReadModel.summary}</h2>
                </div>
                <div className="summary-meta">
                  <span>Generated {formatTimestamp(activeReadModel.generated_at_utc)}</span>
                  <span>Source {publicSourceLabel(activeReadModel.source_system)}</span>
                  <span>Freshness {startCase(activeReadModel.freshness.status)}</span>
                  <span>Loaded {lastRefresh ? formatTimestamp(lastRefresh) : 'Unknown'}</span>
                </div>
              </section>
            ) : null}
            {renderMainView()}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
