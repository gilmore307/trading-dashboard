import { useCallback, useEffect, useMemo, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StageStackedBar, StatusPill } from './components';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel } from './readModels';
import type { DashboardReadModel, HistoricalTaskProgressChartPayload } from './types';
import './styles.css';

const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary_v1';

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
  const publicKeys = ['ref_type', 'kind', 'status', 'contract_type', 'contract_version', 'source_system', 'generated_at_utc'];
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
  const [readModel, setReadModel] = useState<DashboardReadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewId>('status');
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const loadReadModel = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    return fetchLatestReadModel(HISTORICAL_TASK_PROGRESS, signal)
      .then((payload) => {
        setReadModel(payload);
        setError(null);
        setLastRefresh(new Date().toISOString());
      })
      .catch((problem: Error) => {
        if (problem.name === 'AbortError' || signal?.aborted) return;
        setError(problem.message);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReadModel(controller.signal);
    return () => controller.abort();
  }, [loadReadModel]);

  const chart = useMemo(() => {
    if (!readModel || !isHistoricalChart(readModel.chart_payload)) return {} as HistoricalTaskProgressChartPayload;
    return readModel.chart_payload;
  }, [readModel]);

  const renderMainView = () => {
    if (!readModel) return null;
    if (activeView === 'diagnostics') {
      return (
        <section className="diagnostic-grid">
          <RefPanel title="Diagnostic Refs" refs={readModel.diagnostic_refs} />
          <RefPanel title="Issue Refs" refs={readModel.issue_refs} />
          <RefPanel title="Lineage Refs" refs={readModel.lineage_refs} />
          <RefPanel title="Profile Refs" refs={readModel.profile_refs} />
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
              {readModel.diagnostic_refs.length ? readModel.diagnostic_refs.map((ref, index) => (
                <span className="chip" key={index}>{safeRefLabel(ref, `diagnostic_${index + 1}`)}</span>
              )) : <span className="muted">None</span>}
            </div>
          </section>
        </section>
      </>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">◈</div>
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
            <div className="eyebrow">{startCase(activeView)} / Historical Modeling</div>
            <h1>Historical Task Progress</h1>
            <p>
              Public, read-only progress from storage-hosted dashboard summaries. Click the left navigation or the cards below to inspect different slices.
            </p>
          </div>
          <div className="hero-actions">
            {readModel ? <StatusPill status={readModel.status} severity={readModel.severity || 'info'} /> : null}
            <button className="primary-action" type="button" onClick={() => loadReadModel()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {loading && !readModel ? <section className="panel loading-panel">Loading storage read model…</section> : null}

        {error ? (
          <section className="panel error-panel">
            <div className="panel-heading">Read model unavailable</div>
            <p>{error}</p>
            <p className="muted">Run the storage refresh wrapper first, then reload this page.</p>
          </section>
        ) : null}

        {readModel ? (
          <>
            <section className="summary-card">
              <div>
                <div className="eyebrow">{readModel.contract_type}</div>
                <h2>{readModel.summary}</h2>
              </div>
              <div className="summary-meta">
                <span>Generated {formatTimestamp(readModel.generated_at_utc)}</span>
                <span>Source {readModel.source_system}</span>
                <span>Freshness {startCase(readModel.freshness.status)}</span>
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
