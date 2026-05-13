import { useCallback, useEffect, useMemo, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StageStackedBar, StatusPill } from './components';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel, openLatestReadModelSocket, type ReadModelStreamStatus } from './readModels';
import type { CurrentSystemStatusChartPayload, DashboardReadModel, HistoricalTaskProgressChartPayload } from './types';
import './styles.css';

const CURRENT_SYSTEM_STATUS = 'current_system_status_summary';
const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary';

type ViewId = 'status' | 'tasks' | 'diagnostics' | 'models' | 'registry' | 'realtime' | 'performance';

const navItems: Array<{ id: ViewId; label: string; state: string }> = [
  { id: 'status', label: 'Current Status', state: 'Live summary' },
  { id: 'tasks', label: 'Tasks', state: 'Historical live' },
  { id: 'diagnostics', label: 'Diagnostics', state: 'Read-only refs' },
  { id: 'models', label: 'Models', state: 'Contract accepted' },
  { id: 'registry', label: 'Registry Dictionary', state: 'Contract accepted' },
  { id: 'realtime', label: 'Realtime Signals', state: 'Parked' },
  { id: 'performance', label: 'Trading Performance', state: 'Parked' },
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

function sanitizedRefSummary(ref: unknown): string {
  if (typeof ref !== 'object' || ref === null) return String(ref);
  const record = ref as Record<string, unknown>;
  const publicKeys = ['ref_type', 'kind', 'status', 'contract_type', 'schema_version', 'source_system', 'generated_at_utc'];
  const parts = publicKeys
    .filter((key) => key in record)
    .map((key) => `${key}: ${String(record[key])}`);
  return parts.length ? parts.join(' · ') : 'Reference available in storage read model';
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

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <section className="panel placeholder-view">
      <div className="panel-heading">{title}</div>
      <h2>{description}</h2>
      <p>
        This tab is clickable now, but it intentionally waits for an accepted storage-hosted dashboard read model before rendering public data.
      </p>
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
  const chart = useMemo(() => {
    if (!historicalModel || !isHistoricalChart(historicalModel.chart_payload)) return {} as HistoricalTaskProgressChartPayload;
    return historicalModel.chart_payload;
  }, [historicalModel]);
  const systemChart = useMemo(() => {
    if (!currentStatusModel || typeof currentStatusModel.chart_payload !== 'object' || Array.isArray(currentStatusModel.chart_payload)) return {} as CurrentSystemStatusChartPayload;
    return currentStatusModel.chart_payload as CurrentSystemStatusChartPayload;
  }, [currentStatusModel]);

  const renderCurrentStatusView = () => {
    const server = systemChart.server ?? {};
    const services = systemChart.services ?? [];
    const readModels = systemChart.read_models ?? [];
    return (
      <>
        <section className="metric-grid">
          <MetricCard label="Server" value={server.hostname ?? 'Unknown'} hint={`Load ${server.load_average_1m ?? 0} / ${server.load_average_5m ?? 0} / ${server.load_average_15m ?? 0}`} />
          <MetricCard label="API" value={startCase(systemChart.api?.status)} hint={systemChart.api?.websocket_latest_route ?? 'No WebSocket route'} />
          <MetricCard label="Refresh" value={`${systemChart.refresh?.cadence_seconds ?? 0}s`} hint={`Timer ${startCase(systemChart.refresh?.status)}`} />
          <MetricCard label="Storage Free" value={`${server.storage_available_gb ?? 0} GB`} hint={`Total ${server.storage_total_gb ?? 0} GB`} />
        </section>
        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">System Services</div>
            <div className="service-list">
              {services.map((service) => (
                <div className="service-row" key={service.unit}>
                  <span>{service.unit}</span>
                  <strong className={service.healthy ? 'service-ok' : 'service-warn'}>{startCase(service.active_state)}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">Dashboard Read Models</div>
            <div className="service-list">
              {readModels.map((model) => (
                <div className="service-row" key={model.contract_type}>
                  <span>{model.contract_type}</span>
                  <strong className={model.status === 'fresh' ? 'service-ok' : 'service-warn'}>{startCase(model.status)} · {model.age_seconds ?? 'n/a'}s</strong>
                </div>
              ))}
            </div>
          </section>
        </section>
        <section className="panel">
          <div className="panel-heading">Server Resources</div>
          <div className="resource-grid">
            <MetricCard label="Uptime" value={`${Math.round((server.uptime_seconds ?? 0) / 3600)}h`} />
            <MetricCard label="Memory available" value={`${server.memory_available_mb ?? 0} MB`} hint={`Total ${server.memory_total_mb ?? 0} MB`} />
            <MetricCard label="HTTP latest route" value={systemChart.api?.http_latest_route ?? 'Unknown'} />
            <MetricCard label="WebSocket latest route" value={systemChart.api?.websocket_latest_route ?? 'Unknown'} />
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
    if (activeView === 'models') return <PlaceholderView title="Models" description="Model health will appear after a model-summary read model is accepted." />;
    if (activeView === 'registry') return <PlaceholderView title="Registry Dictionary" description="Registry browsing will appear after a public registry read model is accepted." />;
    if (activeView === 'realtime') return <PlaceholderView title="Realtime Signals" description="Realtime monitoring is parked until public realtime read models are accepted." />;
    if (activeView === 'performance') return <PlaceholderView title="Trading Performance" description="Trading performance is parked until post-promotion public summaries exist." />;
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
  const pageEyebrow = activeView === 'status' ? 'Infrastructure / Status' : `${startCase(activeView)} / Historical Modeling`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><img src="/trading-dashboard-icon.png?v=20260513b" alt="" aria-hidden="true" /></div>
          <div>
            <div className="brand-title">Trading Dashboard</div>
            <div className="brand-subtitle">Public read-only operations view</div>
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
        <div className="safety-card">
          <strong>Public read-only</strong>
          <span>Navigation and refresh only read dashboard summaries. No provider calls · no model activation · no broker/account mutation.</span>
        </div>
      </aside>

      <main className="content">
        <header className="hero">
          <div>
            <div className="eyebrow">{pageEyebrow}</div>
            <h1>{pageTitle}</h1>
            <p>
              Public, read-only progress from storage-hosted dashboard summaries. Use the left navigation to inspect different slices; live updates stream over WebSocket with HTTP fallback.
            </p>
          </div>
          <div className="hero-actions">
            {activeReadModel ? <StatusPill status={activeReadModel.status} severity={activeReadModel.severity || 'info'} /> : null}
            <button className="primary-action" type="button" onClick={() => loadReadModel(activeView === 'status' ? CURRENT_SYSTEM_STATUS : HISTORICAL_TASK_PROGRESS)} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {loading && !activeReadModel ? <section className="panel loading-panel">Loading storage read model…</section> : null}

        {error ? (
          <section className="panel error-panel">
            <div className="panel-heading">Read model unavailable</div>
            <p>{error}</p>
            <p className="muted">Run the storage refresh wrapper first, then reload this page.</p>
          </section>
        ) : null}

        {activeReadModel ? (
          <>
            <section className="summary-card">
              <div>
                <div className="eyebrow">{activeReadModel.contract_type}</div>
                <h2>{activeReadModel.summary}</h2>
              </div>
              <div className="summary-meta">
                <span>Generated {formatTimestamp(activeReadModel.generated_at_utc)}</span>
                <span>Source {activeReadModel.source_system}</span>
                <span>Freshness {startCase(activeReadModel.freshness.status)}</span>
                <span>Stream {startCase(streamStatus)}</span>
                <span>Loaded {lastRefresh ? formatTimestamp(lastRefresh) : 'Unknown'}</span>
              </div>
            </section>
            {renderMainView()}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
