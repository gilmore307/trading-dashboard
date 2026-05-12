import type { HistoricalTaskProgressChartPayload, StageCoveragePayload } from './types';
import { formatPercent, startCase } from './format';

export function StatusPill({ status, severity }: { status: string; severity?: string | null }) {
  return <span className={`status-pill status-${severity || 'info'}`}>{startCase(status)}</span>;
}

export function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <section className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </section>
  );
}

export function ProgressBar({ value }: { value?: number }) {
  const normalized = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="progress-wrap" aria-label={`Progress ${formatPercent(normalized)}`}>
      <div className="progress-fill" style={{ width: `${normalized}%` }} />
    </div>
  );
}

export function StageStackedBar({ counts }: { counts?: Record<string, number> }) {
  const entries = Object.entries(counts ?? {}).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <div className="empty-chart">No stage count evidence yet</div>;
  return (
    <div className="stacked-chart">
      <div className="stacked-bar" role="img" aria-label="Stage count distribution">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={`stack-segment stack-${key}`}
            style={{ width: `${(value / total) * 100}%` }}
            title={`${startCase(key)}: ${value}`}
          />
        ))}
      </div>
      <div className="legend-grid">
        {entries.map(([key, value]) => (
          <div className="legend-item" key={key}>
            <span className={`legend-swatch stack-${key}`} />
            <span>{startCase(key)}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoveragePanel({ coverage }: { coverage?: StageCoveragePayload }) {
  if (!coverage) {
    return (
      <section className="panel">
        <div className="panel-heading">Stage Coverage</div>
        <div className="empty-chart">No coverage artifact attached to this summary yet.</div>
      </section>
    );
  }
  const expected = coverage.expected_count ?? 0;
  const ready = coverage.ready_count ?? 0;
  const accepted = coverage.accepted_failed_count ?? 0;
  const failed = coverage.failed_count ?? 0;
  const pending = coverage.pending_count ?? 0;
  const total = Math.max(expected, ready + accepted + failed + pending, 1);
  const segments = [
    ['ready', ready],
    ['accepted_failed', accepted],
    ['failed', failed],
    ['pending', pending],
  ] as const;
  return (
    <section className="panel">
      <div className="panel-heading">Stage Coverage</div>
      <div className="coverage-title">
        <strong>{startCase(coverage.stage_id)}</strong>
        <StatusPill status={coverage.status ?? 'unknown'} severity={coverage.can_unlock_downstream ? 'info' : 'medium'} />
      </div>
      <div className="stacked-bar tall" role="img" aria-label="Coverage distribution">
        {segments.map(([key, value]) => value > 0 ? (
          <div key={key} className={`stack-segment stack-${key}`} style={{ width: `${(value / total) * 100}%` }} />
        ) : null)}
      </div>
      <div className="coverage-grid">
        <MetricCard label="Expected" value={expected} />
        <MetricCard label="Ready" value={ready} />
        <MetricCard label="Accepted skips" value={accepted} />
        <MetricCard label="Pending" value={pending} />
      </div>
    </section>
  );
}

export function HistoricalProgressVisual({ chart }: { chart: HistoricalTaskProgressChartPayload }) {
  return (
    <div className="visual-grid">
      <section className="panel wide">
        <div className="panel-heading">Historical Modeling Progress</div>
        <div className="progress-row">
          <div>
            <div className="huge-number">{formatPercent(chart.progress_percent)}</div>
            <div className="muted">Terminal stages completed / total stages</div>
          </div>
          <ProgressBar value={chart.progress_percent} />
        </div>
        <StageStackedBar counts={chart.stage_counts} />
      </section>
      <CoveragePanel coverage={chart.stage_coverage} />
    </div>
  );
}
