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
storage/06_dashboard_cache/read_models/<contract_type>/latest.json
```

`trading-dashboard` reads those summaries directly through the Vite HTTP and WebSocket routes:

```text
/api/read-models/<contract_type>/latest
/ws/read-models/<contract_type>/latest
```

The WebSocket route sends a snapshot on connect and on `latest.json` changes, with mtime polling as a backstop when filesystem watcher events are missed. The browser also polls `historical_task_progress_summary` as a read-only fallback so task progress does not depend on one notification path.

The dashboard renders Status, Tasks, Timewheel, Models, Diagnostics, Data, and Realtime Signals without querying raw internals for primary page content.

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

The current public storage refresh set is `current_system_status_summary`, `historical_task_progress_summary`, `temporal_explorer_summary`, `realtime_signal_summary`, and `execution_realtime_trading_runtime_status`. Other contracts below are accepted dashboard vocabulary only after their producer, storage layout, and presentation route are accepted.

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

Dashboard Data copy must say these timestamps are source artifact write times, not dashboard read-model refresh times. Heartbeat artifacts are expected to move continuously; event-driven artifacts move only when decisions or stage progress are recorded. Status consumes `chart_payload.runtime_throughput` to render the Runtime Throughput card with the 3 month-ingest + 1 model-worker topology, six-month fold cadence, completion rate, peak completion burst, observation window, and idle/blocked decision count. `chart_payload.parallelism` is subordinate provider-dispatch/resource-gate detail.

Hidden by default:

- raw systemd logs;
- lock-file internals;
- request/run/artifact/receipt row dumps;
- daemon implementation details.

### `alert_exception_summary`

Purpose: support the Alerts and Exceptions page.

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

The alert page is an owner-actionable issue queue, not a log viewer.

### `historical_task_progress_summary`

Purpose: support the Historical Modeling subtab under Tasks.

Current semantic producer: `trading-manager/scripts/tasks/build_historical_task_progress_summary.py` builds this payload from read-only scheduler/status evidence. Dashboard consumption is through `trading_dashboard.read_models.read_historical_task_progress_latest`, `scripts/read_models/read_latest_dashboard_read_model.py historical_task_progress_summary`, `/api/read-models/historical_task_progress_summary/latest`, `/ws/read-models/historical_task_progress_summary/latest`, and the Tasks/Models views.

Owner-facing fields:

- task timeline listing past, current, and future child-task rows at `fold/period + layer + phase` granularity, with canonical phase labels such as data acquisition, feature generation, model generation, model evaluation, Promotion Review, and maintenance; historical training rows use the fold as the public task period and expose month child partitions in detail instead of projecting fold source/feature work into separate month rows; model-group replay rows keep the training fold as a `YYYY-foldN` period such as `2016-fold1` and expose exact training/replay windows separately in detail; fold rows whose full month span is not complete are capped by the latest completed calendar month in `America/New_York`, so the current incomplete fold is not exposed as a Ready task; the dashboard groups this timeline by period/fold, filters it by period/layer/status/task type/target, orders filter choices by chronological/workflow sequence rather than label alphabetization, defaults to current `Now` work, and can expand each row using sanitized detail fields including generated, started, ended, and status-updated timestamps when available; worker identity remains internal execution detail and is not shown or used as a Tasks filter because a fold can run through multiple provider or ingest lanes; task progress is shown only from real evidence such as row counts, replay/month counts, elapsed/expected time, stage coverage, or active progress files under manager runtime;
- current period, which can be one month or a training fold such as `2016-fold1`;
- active public task from the task timeline; internal scheduler stage ids remain diagnostic fields and must not redefine owner-facing Evaluation semantics;
- progress percentage;
- ready/pending/failed counts;
- latest attached stage-coverage counts when the storage refresh wrapper can locate a manager coverage artifact;
- latest stage-execution status, return code, failure reason, and stdout/stderr/receipt evidence refs when available;
- sanitized agent-error summary rows from the server error catalog, preserving permanent `ERR-*` refs and exposing diagnosis status, repair status, handling status, retry recommendation, and bounded root-cause text;
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

Purpose: support the Realtime Trading subtab under Tasks.

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

Purpose: support the Timewheel / Temporal Explorer page.

Current implementation: `trading-storage` builds this summary from accepted Temporal Explorer substrate tables, chart cache, execution runtime status, and replay artifact root. The dashboard shows substrate population as a status card above the chart, treats the chart x-axis as the Timewheel, lets the user select symbol/frame/center time locally with ticks aligned to frame boundaries, and shows lower subcharts such as volume and accepted-event density. Chart-axis event markers are restricted to Layer 10 accepted event families; ordinary scheduled events, released macro results, and news index rows appear as substrate population/readiness, not chart markers. `chart_ohlcv_cache` is shown as visualization cache only, not training truth.

Owner-facing fields:

- viewport center, selected frame, available frames, and visible start/end;
- timewheel ticks with market-session status and marker counts;
- chart-axis event marker positions and subchart-ready volume/accepted-event-density values;
- status lanes for market sessions, scheduled events, event results, news index, model event markers, and replay state;
- event markers for the currently selected time unit;
- compact chart bars when `chart_ohlcv_cache` is populated;
- substrate table statuses.

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

### `model_layer_readiness_summary`

Purpose: support the Models page and ten layer subtabs.

Owner-facing fields per layer:

- layer id and name;
- model status;
- latest version or run id summary;
- update timestamp;
- key parameter/config summary;
- performance metric summary;
- known limitations;
- blocker summary;
- promotion posture;
- profile refs for visible metrics and status fields.

Canonical layer map:

| Layer | Name | Conceptual output |
|---|---|---|
| 1 | Market Regime | `market_context_state` |
| 2 | Sector Context | `sector_context_state` |
| 3 | Target State Vector | `target_context_state` |
| 4 | Event Failure Risk | `event_failure_risk_vector` |
| 5 | Alpha Confidence | `alpha_confidence_vector` |
| 6 | Dynamic Risk Policy | `dynamic_risk_policy_state` |
| 7 | Position Projection | `position_projection_vector` |
| 8 | Underlying Action | `underlying_action_plan` / `underlying_action_vector` |
| 9 | Trading Guidance / Option Expression | `trading_guidance_record` plus optional `option_expression_plan` / `expression_vector` |
| 10 | Event Risk Governor / Event Intelligence Overlay | `event_risk_intervention` / event-adjusted risk guidance |

Dashboard model pages must follow the accepted current layer map.

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

### `registry_dictionary_profile`

Purpose: support Registry Dictionary and hover field profiles.

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

The registry dictionary is read-only. It must not expose editor controls or replace `trading-manager` registry governance.

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

Future purpose: support Trading Performance Summary.

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
