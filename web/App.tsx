import { useEffect, useMemo, useState } from 'react';
import { HistoricalProgressVisual, MetricCard, StatusPill } from './components';
import { formatTimestamp, startCase } from './format';
import { fetchLatestReadModel } from './readModels';
import type { DashboardReadModel, HistoricalTaskProgressChartPayload } from './types';
import './styles.css';

const HISTORICAL_TASK_PROGRESS = 'historical_task_progress_summary_v1';

const navItems = [
  { label: 'Current Status', state: 'Coming after summary producer' },
  { label: 'Alerts', state: 'Coming after alert model' },
  { label: 'Tasks', state: 'Historical live' },
  { label: 'Models', state: 'Contract accepted' },
  { label: 'Registry Dictionary', state: 'Contract accepted' },
  { label: 'Realtime Signals', state: 'Parked' },
  { label: 'Trading Performance', state: 'Parked' },
];

function isHistoricalChart(payload: DashboardReadModel['chart_payload']): payload is HistoricalTaskProgressChartPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function App() {
  const [readModel, setReadModel] = useState<DashboardReadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchLatestReadModel(HISTORICAL_TASK_PROGRESS, controller.signal)
      .then((payload) => {
        setReadModel(payload);
        setError(null);
      })
      .catch((problem: Error) => {
        if (problem.name === 'AbortError' || controller.signal.aborted) return;
        setError(problem.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const chart = useMemo(() => {
    if (!readModel || !isHistoricalChart(readModel.chart_payload)) return {} as HistoricalTaskProgressChartPayload;
    return readModel.chart_payload;
  }, [readModel]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">◈</div>
          <div>
            <div className="brand-title">Trading Dashboard</div>
            <div className="brand-subtitle">Read-only operations view</div>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary dashboard navigation">
          {navItems.map((item) => (
            <button className={`nav-item ${item.label === 'Tasks' ? 'active' : ''}`} key={item.label}>
              <span>{item.label}</span>
              <small>{item.state}</small>
            </button>
          ))}
        </nav>
        <div className="safety-card">
          <strong>Safety boundary</strong>
          <span>No provider calls · no model activation · no broker/account mutation</span>
        </div>
      </aside>

      <main className="content">
        <header className="hero">
          <div>
            <div className="eyebrow">Tasks / Historical Modeling</div>
            <h1>Historical Task Progress</h1>
            <p>
              Owner-facing progress from storage-hosted dashboard summaries. Raw manager internals stay hidden unless a visible blocker needs diagnostics.
            </p>
          </div>
          {readModel ? <StatusPill status={readModel.status} severity={readModel.severity || 'info'} /> : null}
        </header>

        {loading ? <section className="panel loading-panel">Loading storage read model…</section> : null}

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
              </div>
            </section>

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
                    <span className="chip" key={index}>{typeof ref === 'object' && ref !== null && 'ref_type' in ref ? String(ref.ref_type) : `diagnostic_${index + 1}`}</span>
                  )) : <span className="muted">None</span>}
                </div>
              </section>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;
