# Dashboard Read Models

## Purpose

This document defines the owner-facing summary/read-model surfaces that `trading-dashboard` should consume from `trading-storage`.

The dashboard must not build primary pages directly from raw control-plane internals such as manager requests, run manifests, artifact refs, ready-signal rows, raw receipts, daemon logs, registry SQL history, storage lifecycle internals, or execution adapter records.

Instead, each page should consume a small storage-hosted summary contract designed for owner-facing status, charts, alerts, explanations, and drilldowns.

## Core Rule

```text
raw internal evidence -> upstream/component aggregation -> trading-storage materialized dashboard summary -> chart-first UI
```

`trading-storage` materializes dashboard read models under the accepted storage route:

```text
storage/06_dashboard_cache/read_models/<contract_type>.json
```

`trading-dashboard` reads those summaries directly through the Vite HTTP and WebSocket routes:

```text
/api/read-models/<contract_type>/latest
/ws/read-models/<contract_type>/latest
```

The WebSocket route sends the current read model on connect and on current-file changes, with mtime polling as a backstop when filesystem watcher events are missed. The browser also polls `historical_task_progress_summary` as a read-only fallback so task progress does not depend on one notification path.

The dashboard renders Status, Tasks, Events, Models, Replay Performance, Replay Decisions, Replay Operations, Diagnostics, Data, and Realtime Signals without querying raw internals for primary page content.

The dashboard reads storage-hosted read models. It does not become the component that interprets every raw operational table. `trading-storage` owns durable/materialized placement, retention, backup, restore, and lifecycle policy for these summaries; semantic generation remains with the component that understands the data.

Raw evidence may appear only through an issue-focused diagnostic drilldown for a visible status, blocker, alert, model issue, signal issue, or performance anomaly.

When a new website page or read adapter begins depending on additional original source outputs, the corresponding Dashboard Data/source-output inventory must be updated alongside that feature. The dashboard summary may stay sanitized and compact, but the owner-facing freshness view must not silently omit raw/source artifacts that now feed visible pages.

## Shared Read-Model Envelope

Every storage-hosted dashboard read model should follow the common envelope accepted in `trading-storage/docs/41_dashboard_summary_layout.md`. At dashboard level, the visible fields include these concepts where applicable:

| Field | Purpose |
|---|---|
| `contract_type` | Stable read-model contract name. |
| `generated_at_utc` | Freshness timestamp. |
| `source_system` | Owning upstream system or aggregator. |
| `status` | Owner-facing state. |
| `severity` | `critical`, `high`, `medium`, `low`, or `info` where relevant. |
| `summary` | One-sentence human-readable state. |
| `chart_payload` | Compact chart-ready values. |
| `profile_refs` | Registry/profile references for visible fields. |
| `issue_refs` | Alert/exception ids related to the summary. |
| `diagnostic_refs` | Optional evidence references for issue-focused drilldowns only. |

## Dashboard Read-Model Contracts

The current public storage refresh set is `current_system_status_summary`, `historical_task_progress_summary`, `temporal_explorer_summary`, `realtime_signal_summary`, `execution_realtime_trading_runtime_status`, `model_readiness_summary`, `model_promotion_posture_summary`, and `model_group_replay_review_summary`. Other contracts below are accepted dashboard vocabulary only after their producer, storage layout, and presentation route are accepted.

### `current_system_status_summary`

Purpose: support the Status page.

Owner-facing fields:

- server/resource health summary;
- API/provider reachability and freshness;
- key service state;
- dashboard source-output freshness rows, including `heartbeat` vs `event_driven` freshness semantics;
- historical scheduler summary;
- realtime monitor summary if active;
- storage health summary;
- unresolved alert counts by severity;
- readiness/safety-gate posture where it affects user-facing readiness.

Storage lifecycle should appear here as a health card, not as a standalone main tab by default.

Suggested storage fields:

- disk pressure;
- last lifecycle scan;
- cleanup candidate count;
- protected-set size;
- last compression/archive/delete receipt summary;
- restore verification status.

Dashboard Data copy must say these timestamps are source artifact write times, not dashboard read-model refresh times. Heartbeat artifacts are expected to move continuously; event-driven artifacts move only when decisions or stage progress are recorded. Status consumes `chart_payload.runtime_throughput` to render the Runtime Throughput card with the 1 month-ingest + 1 model-worker topology, 18-month fold window, 12-month fold step, completion rate, peak completion burst, observation window, and idle/blocked decision count. `chart_payload.parallelism` is subordinate provider-dispatch/resource-gate detail.

Hidden by default:

- raw systemd logs;
- lock-file internals;
- request/run/artifact/receipt row dumps;
- daemon implementation details.

### `alert_exception_summary`

Purpose: support Diagnostics with owner-facing visible errors and degraded states.

Owner-facing fields:

- `alert_id`;
- `alert_type`;
- `severity`;
- `affected_area`;
- `first_seen_at_utc`;
- `last_seen_at_utc`;
- `age_seconds`;
- `current_status`;
- `owner_action_required`;
- `suggested_next_action`;
- `blocking_scope`;
- `summary`;
- optional `diagnostic_refs`.

Initial alert taxonomy:

- `data_freshness_alert`;
- `provider_unavailable_alert`;
- `model_promotion_blocked_alert`;
- `model_drift_alert`;
- `runtime_signal_degraded_alert`;
- `execution_connectivity_alert`;
- `storage_pressure_alert`;
- `protected_set_conflict_alert`;
- `lifecycle_policy_blocked_alert`;
- `restore_smoke_failed_alert`;
- `registry_contract_mismatch_alert`;
- `dashboard_data_stale_alert`.

Diagnostics is an owner-facing error/status summary, not a log viewer.

### `historical_task_progress_summary`

Purpose: support Tasks in the Historical Models navigation group.

Current semantic producer: `trading-manager/scripts/tasks/build_historical_task_progress_summary.py` builds this payload from read-only scheduler/status evidence. Dashboard consumption is through `trading_dashboard.read_models.read_historical_task_progress_latest`, `scripts/read_models/read_latest_dashboard_read_model.py historical_task_progress_summary`, `/api/read-models/historical_task_progress_summary/latest`, `/ws/read-models/historical_task_progress_summary/latest`, and the Tasks view. Tasks consumes the timeline as an operational work list. Models consumes dedicated model summaries for evaluation; task progress does not drive model-page wording.

Owner-facing fields:

- task timeline listing past, current, and future child-task rows at `fold/period + layer + phase` granularity, with canonical phase labels such as data acquisition, feature generation, model generation, model evaluation, Promotion Review, and maintenance; historical training rows use the fold as the public task period and expose month child partitions in detail instead of projecting fold source/feature work into separate month rows; model-group replay rows keep the training fold as a fold-period range and expose exact training/replay windows separately in detail; fold rows whose full month span is not complete are capped until that fold's final calendar month has completed in `America/New_York`, so the current incomplete fold is not exposed as a Ready task; public task numbers are continuous row sequence numbers assigned after chronological fold, layer, and workflow-stage sorting, while `task_uid` remains the durable progress/evidence identity; the dashboard groups this timeline by period/fold, filters it by period/layer/status/task type/target, orders filter choices by chronological/workflow sequence rather than label alphabetization, puts model-numbered task choices such as M01-M06 before model-group lifecycle choices such as replay, evaluation, promotion, and maintenance, defaults to current `Now` work, and can expand each row using sanitized detail fields including generated, started, ended, and status-updated timestamps when available; worker identity remains internal execution detail and is not shown or used as a Tasks filter because a fold can run through multiple provider or ingest lanes; task progress is shown from real evidence such as row counts, replay/month counts, elapsed/expected time, stage coverage, or active progress files under manager runtime; active worker progress is the primary progress bar for running tasks when it reports concrete work units such as source-month requests, feature months, model rows, replay timestamps, or attribution units, while broader internal-stage progress is kept only as parent context; fold data-acquisition progress aggregates source-month request coverage across the 12+3+3 fold, and post-replay M06 progress counts replay failure-attribution units rather than a single receipt; when an active progress file only proves that a stage process has started, the row exposes task-type-specific 0/1 stage progress instead of estimating an arbitrary percentage; running task details may include `runtime_activity` for the exact current action; the Tasks page intentionally has no separate Logs section, so producers must improve `runtime_activity` when Live is too coarse;
- current period, which can be one month or a training fold such as `2016-01..2017-06`;
- active public task from the task timeline; internal scheduler stage ids remain diagnostic fields and must not redefine owner-facing Evaluation semantics;
- progress percentage;
- ready/pending/failed counts;
- latest attached stage-coverage counts when the storage refresh wrapper can locate a manager coverage artifact;
- latest stage-execution status, return code, failure reason, and stdout/stderr/receipt evidence refs when available;
- sanitized agent-error summary rows from the server error catalog, preserving permanent `ERR-*` refs and exposing diagnosis status, repair status, Codex/agent auto-repair intervention state, handling status, retry recommendation, and bounded root-cause text;
- service runtime, scheduler lock, provider posture, and terminal-complete gates;
- blocker category;
- next expected system action;
- last successful stage;
- current failure or alert refs.

Hidden by default:

- manager request payloads;
- run manifests;
- artifact refs;
- ready-signal rows;
- raw stage receipts.

### `realtime_task_progress_summary`

Purpose: support realtime task-state visibility when it is surfaced under the Realtime navigation group.

Owner-facing fields:

- realtime task state;
- active/parked status;
- prerequisite checklist;
- latest monitor state if active;
- blocker category;
- next expected system action.

If realtime work is parked, the read model should say so plainly instead of fabricating signal or performance metrics.
If realtime monitoring has not started, `realtime_signal_summary` should say `not_started` with zero provider/model/broker/account mutations and an explicit gap message.

### `temporal_explorer_summary`

Purpose: support the event timeline section of the Events page.

Current implementation: `trading-storage` builds this summary from accepted event-attention-pool inputs, market-session context, and ETF chart bars for the current model-group replay window. The dashboard Events page renders the primary chart as a TradingView-style K-line surface, lets the user select SPY/QQQ/IWM/DIA and 1D/1W locally, and shows lower subcharts such as volume and accepted-event density. Chart-axis event markers are restricted to M06 accepted event families; ordinary scheduled events, released macro results, and news index rows remain evidence inputs until M06 promotes them. Chart bars are display context only, not training truth.

Owner-facing fields:

- viewport center, selected frame, available frames, and visible start/end;
- timewheel ticks with market-session status and marker counts;
- chart-axis event marker positions and subchart-ready volume/accepted-event-density values;
- status lanes for market sessions, scheduled events, event results, news index, model event markers, and replay state;
- event markers for the currently selected time unit;
- TradingView-style chart bars when `chart_ohlcv_cache` is populated;
- context input statuses.

Hidden by default:

- raw SQL rows;
- chart-cache rows outside the viewport;
- provider credentials or source secret paths;
- dashboard-originated refresh controls.

### `realtime_signal_summary`

Purpose: support the Realtime Signals page.

Current implementation: `trading-storage` builds this summary from execution-owned realtime monitor receipts when they exist, or from an explicit safe empty state when they do not. The dashboard displays monitor mode/state, completed/failed cycles, provider-observation count, signal-readiness cards, handoff-readiness cards, safety-boundary flags, and visible gaps.

Hidden by default:

- raw monitor receipt payloads;
- provider payloads;
- order, broker, account, or adapter internals;
- model activation internals.

### `execution_realtime_trading_runtime_status`

Purpose: support WebSocket/runtime-readiness clients that need execution runtime posture without reading execution internals.

Current implementation: `trading-storage` builds this summary from the execution-owned runtime readiness artifact. Dashboard clients consume it through `/ws/read-models/execution_realtime_trading_runtime_status/latest` or the matching HTTP latest route. The payload exposes active model pointer state, next gate, connected interfaces, allowed action flags, required runtime inputs, and safety counters. It performs no provider calls, model activation, order construction, broker execution, or account mutation.

Hidden by default:

- raw execution adapter payloads;
- broker/account/order/fill state;
- secret paths or provider credentials;
- model activation internals.

### `model_readiness_summary`

Purpose: support the Models page model-group versions view.

Owner-facing fields per layer readiness row:

- layer id and name;
- latest version or run id summary;
- update timestamp;
- key parameter/config summary;
- performance metric summary;
- known limitations;
- profile refs for visible metrics and status fields.

Group-level fields own active/shadow/retiring/eliminated model refs when those refs are decided for the full model group rather than for an isolated layer.

Dashboard presentation:

- Models shows one model-group versions view;
- no selected model means summary mode with global comparison charts; selecting a model switches the page into focus mode with internal diagnostics for that version;
- group page shows active live, shadow, retiring, eliminated, evaluation, promotion, and promotion-rate posture;
- group page charts are organized as model statistical-validity families: Ranking / Calibration, Selection Diagnostics, Feature Space, Integrity / Uncertainty, and Temporal Stability;
- AUROC/ROC, PR-AUC, Brier, calibration, decision-variable schema/coverage, silhouette, PCA, PCoA, data integrity, uncertainty, and temporal AUROC/Brier stability carry the owner-facing model-validity interpretation when published;
- replay normalized NAV, performance metrics, threshold utility, cost sensitivity, score-decile return, baseline/no-trade comparisons, economic robustness, trading-distribution slices, trade-level rows, and monthly replay drilldowns live under Replay Performance or Replay Decisions rather than Models;
- candidate refs, task states, task blockers, workflow progress, safety gates, receipts, and operational debug timelines stay under Tasks/Diagnostics and are not primary model-page content.

Canonical model map:

| Model | Name | Conceptual output |
|---|---|---|
| M01 | Background Context | `market_context_state`, `sector_context_state` |
| M02 | Target State | `target_context_state` |
| M03 | Event State | `event_state_vector` |
| M04 | Unified Decision | `unified_decision_vector` |
| M05 | Option Expression | `option_expression_plan` |
| M06 | Residual Event Governance | `residual_event_governance_state` |

The accepted current model map remains the model-stack reference, but the current Models tab does not expose component-model pages in the primary navigation.

### `model_promotion_posture_summary`

Purpose: summarize whether a model is blocked, deferred, eligible for review, approved, rejected, revoked, or superseded.

Owner-facing fields:

- model/layer reference;
- promotion status;
- latest agent decision status where available;
- missing evidence categories;
- blocker summary;
- activation status;
- last update.

The dashboard must not activate models. It only reports promotion posture.

Replay Performance presentation:

- Replay Performance initially consumes `model_promotion_posture_summary.group_versions` for historical replay economics because that is where current version-level replay diagnostics are published;
- published replay group versions must come from the live-flow candidate-policy route: M01/M02 base context is only reusable context, while trade candidates must be evidenced by the M02 target-candidate handoff or an explicit reviewed preview override;
- Performance charts must normalize every strategy, ETF, M01, M02, and context comparison series to `1.0` at the selected start. The replay `25000 USD` initial capital is execution/risk-limit metadata, not the chart scale;
- Replay Performance owns one normalized NAV chart slot: no selected model group renders all published model groups as simple normalized NAV lines, multiple selected model groups renders only those selected groups as simple normalized NAV lines, and exactly one selected model group renders a monthly normalized NAV K-line;
- no selected replay model group means comparison mode across all published versions; multiple selected replay model groups means comparison mode over the selected subset; exactly one selected replay model group means focus mode for that model group;
- monthly normalized NAV K-line uses replay return slices compounded from `1.0`; when a slice publishes `net_return_path_ohlc`, the candle high/low must come from that row-level replay return path rather than from endpoint-only open/close values;
- performance summary is table-first: series identity, target, normalized NAV, total return, excess return, max drawdown, annualized return, volatility, Sharpe, Sortino, Calmar, beta, and monthly win rate are shown in one selector table;
- metric comparison charts show cross-model total return, drawdown, excess return, annualized return, volatility, Sharpe, Sortino, Calmar, beta, and win rate when published;
- Trading Performance Diagnostics is selected-model-only and may show detailed return, risk, trade outcome, decision-scale, replacement, regret, notional, and review-coverage statistics for that model group;
- selected-model lower panels should use metric cards, ratio/donut visuals, or omit charts when a metric family mixes incompatible units; do not force unrelated counts, returns, notional, and ratios into one bar chart merely because the values exist;
- ETF, M01, M02, and sector-anchor comparison series stay absent until a read model publishes them; the dashboard must not fabricate benchmark rows from missing evidence.

Replay Decisions legacy presentation:

- Replay Decisions consumes the same `replay_run_id`, version scope, time range, and selected month/cursor as Replay Performance when those fields are available;
- no selected replay version means decision summary mode across all published versions; one selected replay version shows focused decision curves, slice distribution, and monthly decision rows; multiple selected replay versions show selected-set decision comparison;
- decision version selection focuses the version/run whose component decisions are being inspected;
- replay slice/contribution distributions belong in Replay Decisions because they explain decision flow and component behavior, not headline trading performance;
- full Monthly Replay detail is a model-scoped detail window, and month clicks route to a historical replay decision-detail table sourced through the read-only dashboard replay decision API;
- trade-level replay decision detail must remain historical replay evidence with sanitized fields such as timestamp, target/instrument, action/disposition, fill status, score, returns, cost, reason codes, and component decision trace; it must not present broker/account/order mutation controls;
- legacy `/api/replay-decisions` rows may still include `decision_trace`; component-first trace display is supporting context only;
- model provenance and layer attribution now define the Replay Decisions primary hierarchy when `model_group_replay_review_summary` is published;
- Replay Operations owns execution graph health, operation status, source readiness, and missing-evidence diagnostics rather than decision-result attribution;
- future storage work should split large replay payloads into a dedicated replay read model when promotion posture is no longer the narrow canonical home.

### `model_group_replay_review_summary`

Purpose: support Replay Performance, Replay Decisions, and Replay Operations from post-replay review artifacts without exposing raw artifact directories as primary UI content.

Current semantic source:

- `post_replay_review_runs/*/post_replay_review_receipt.json`;
- `post_replay_review_runs/*/replay_review_performance_summary.json`;
- `post_replay_review_runs/*/replay_review_rows.jsonl`;
- the replay execution `decision_rows_ref` named by the matching post-replay review receipt;
- `post_replay_review_runs/*/layer_attribution/parameter_replay_review_report.json`.

Producer rule:

- the storage read model publishes only the latest completed post-replay review run for each current `candidate_fold_id`; older same-fold rerun artifacts are storage lifecycle cleanup candidates, not parallel selector rows.

Dashboard presentation:

- Replay Performance consumes `review_runs[].performance` for trading-performance evidence such as decision rows, fill counts, target performance, stock selection, option expression, and replacement review;
- Replay Decisions consumes `review_runs[].replay_decisions_m01_m05` as its primary contract; the page renders five separate M01-M05 layer chapters, each with its own layer-quality comparison table, charts, and focused effective layer-decision ledger; current runs read dedicated `layer_review_rows_ref` evidence with one scored row per replay decision per included layer, while replay decision-row synthesis is only a legacy fallback; `decision_review` and `parameter_review` remain supporting attribution/parameter context, not the primary correctness surface;
- Replay Operations uses the same Model Group Replay Selector as Replay Performance and consumes first-gap component/mechanism, option path status, fill status, replacement mechanics, and other component/surface diagnostics projected from the matching replay review run;
- every page keeps the same three dimensions: model-group comparison, individual model-group analysis, and Focus/detail drilldown by source refs.

Safety/interpretation constraints:

- The read model is a projection over completed artifacts only. It performs no replay, provider calls, model activation, broker execution, account mutation, or dashboard-originated storage mutation beyond read-model materialization.
- Future returns and best-available labels are post-replay review labels. They must not be displayed as decision-time information unless the source row explicitly proves point-in-time knowability.
- Raw review rows stay provenance/drilldown evidence rather than a global artifact browser.

### `registry_dictionary_profile`

Purpose: support Definitions and hover field profiles.

Owner-facing fields:

- canonical name;
- display label;
- short meaning;
- kind;
- source repository;
- canonical path where useful;
- accepted values or range;
- high-is-good / high-is-bad / neutral orientation where applicable;
- related terms;
- usage examples where useful;
- last updated.

Definitions is read-only. It must not expose editor controls or replace `trading-manager` registry governance.

## Parked/Future Read Models

These contracts should exist only when the underlying systems provide mature evidence.

### `runtime_decision_quality_summary`

Future purpose: summarize realtime/shadow decision quality once matured outcome labels exist.

Possible owner-facing fields:

- direction accuracy;
- net utility success rate;
- target-before-stop rate;
- confidence calibration by bucket;
- no-trade avoided-bad-trade rate;
- no-trade missed-positive-utility rate.

### `trading_performance_summary`

Future purpose: support Trading Performance.

Required distinction:

- `shadow` performance;
- `paper` performance;
- `live` performance.

These modes must never be merged into one ambiguous performance number.

Possible owner-facing fields:

- PnL;
- drawdown;
- exposure;
- win/loss;
- expectancy;
- slippage;
- fill quality;
- model decision vs realized outcome attribution;
- capital/risk usage.

### `storage_lifecycle_status_summary`

Future purpose: summarize storage lifecycle posture for Status and Alerts.

This should not become a standalone main tab unless storage pressure becomes a daily owner-facing concern.

Possible owner-facing fields:

- disk pressure;
- protected-set status;
- lifecycle policy status;
- latest lifecycle scan;
- compression/archive/delete summary;
- restore verification status;
- active storage lifecycle alerts.

## Diagnostic Access Rule

Advanced Diagnostics can only be entered from a visible owner-facing issue.

Allowed entry points:

- an alert;
- a blocked task;
- a model promotion blocker;
- a degraded realtime signal;
- a trading performance anomaly;
- a stale dashboard data warning.

Disallowed primary surfaces:

- global artifact browser;
- global receipt browser;
- global log viewer;
- global control-plane table browser;
- raw registry row browser as default view;
- daemon internals explorer.

## Storage Home

Dashboard summary/read-model outputs belong in `trading-storage` as the durable/materialized home. This keeps the dashboard read-only and prevents it from directly coupling to raw manager/model/data/execution internals.

Responsibilities split as follows:

- `trading-storage` owns physical placement, retention, backup, restore, archive, materialized snapshot history, and lifecycle treatment for dashboard summaries.
- `trading-manager`, `trading-model`, `trading-execution`, `trading-data`, and `trading-storage` each own the semantics of summaries for their domains.
- `trading-dashboard` owns presentation only.
- `trading-manager` remains the registry/governance route for shared contract names before implementation.

The companion storage-side design contracts are `trading-storage/docs/40_dashboard_read_models.md` and `trading-storage/docs/41_dashboard_summary_layout.md`. Shared contract names are governed through `trading-manager`.
