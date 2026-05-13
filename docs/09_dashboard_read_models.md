# Dashboard Read Models

## Purpose

This document defines the owner-facing summary/read-model surfaces that `trading-dashboard` should consume from `trading-storage`.

The dashboard must not build primary pages directly from raw control-plane internals such as manager requests, run manifests, artifact refs, ready-signal rows, raw receipts, daemon logs, registry SQL history, storage lifecycle internals, or execution adapter records.

Instead, each page should consume a small storage-hosted summary contract designed for owner-facing status, charts, alerts, explanations, and drilldowns.

## Core Rule

```text
raw internal evidence -> upstream/component aggregation -> trading-storage materialized dashboard summary -> chart-first UI
```

`trading-storage` now has the first materialization and refresh helpers for the storage step: `scripts/dashboard/materialize_read_model.py` validates a producer-supplied common envelope, and `scripts/dashboard/refresh_historical_task_progress_read_model.py` runs the manager-owned historical progress producer before writing snapshot/latest/schema/index files under the accepted `storage/dashboard/` layout. `trading-dashboard` now has the first read adapter and website slice: `src/trading_dashboard/read_models.py` reads accepted `latest.json` summaries, while the Vite/React Historical Modeling page renders `historical_task_progress_summary` without querying raw internals.

The dashboard reads storage-hosted read models. It does not become the component that interprets every raw operational table. `trading-storage` owns durable/materialized placement, retention, backup, restore, and lifecycle policy for these summaries; semantic generation remains with the component that understands the data.

Raw evidence may appear only through an issue-focused diagnostic drilldown for a visible status, blocker, alert, model issue, signal issue, or performance anomaly.

When a new website page or read adapter begins depending on additional original source outputs, the corresponding Dashboard Data/source-output inventory must be updated alongside that feature. The dashboard summary may stay sanitized and compact, but the owner-facing freshness view must not silently omit raw/source artifacts that now feed visible pages.

## Shared Read-Model Envelope

Every storage-hosted dashboard read model should follow the common envelope accepted in `trading-storage/docs/97_dashboard_summary_layout.md`. At dashboard level, the visible fields include these concepts where applicable:

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

## Initial Implementation Read Models

The first dashboard implementation should target these owner-facing surfaces, read from `trading-storage`, before any deep diagnostics or parked realtime/performance pages.

### `current_system_status_summary`

Purpose: support the Current Status page.

Owner-facing fields:

- server/resource health summary;
- API/provider reachability and freshness;
- key service state;
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

Current semantic producer: `trading-manager/scripts/tasks/build_historical_task_progress_summary.py` builds this payload from read-only scheduler/status evidence. Storage materialization and refresh orchestration are handled by `trading-storage/scripts/dashboard/refresh_historical_task_progress_read_model.py`; storage also carries reviewed systemd service/timer templates for periodic refresh. Dashboard consumption is through `trading_dashboard.read_models.read_historical_task_progress_latest`, `scripts/read_models/read_latest_dashboard_read_model.py historical_task_progress_summary`, and the first Vite/React Historical Modeling page.

Owner-facing fields:

- task timeline listing past, current, and future child-task rows at `month + layer + phase` granularity, with phase-level labels such as data acquisition, feature generation, model generation, evaluation, promotion review preparation, and maintenance; the dashboard groups this timeline by month, filters it by month/layer/status/task type, defaults to current `Now` work, and can expand each row using sanitized detail/progress fields;
- current month or active historical window;
- active layer/stage;
- progress percentage;
- ready/pending/failed counts;
- latest attached stage-coverage counts when the storage refresh wrapper can locate a manager coverage artifact;
- latest stage-execution status, return code, failure reason, and stdout/stderr/receipt evidence refs when available;
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

### `model_layer_readiness_summary`

Purpose: support the Models page and eight layer subtabs.

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
| 4 | Event Overlay | `event_context_vector` |
| 5 | Alpha Confidence | `alpha_confidence_vector` |
| 6 | Position Projection | `position_projection_vector` |
| 7 | Underlying Action | `underlying_action_plan` / `underlying_action_vector` |
| 8 | Option Expression | `option_expression_plan` / `expression_vector` |

Dashboard model pages must follow the accepted current layer map and must not revive old Layer 7 option-expression/final-action wording.

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

### `realtime_signal_summary`

Future purpose: support Realtime Trading Signals.

Possible owner-facing fields:

- monitored universe size;
- active candidate count;
- actionable signal count;
- shadow signal count;
- blocked signal count;
- signal freshness;
- signal confidence distribution;
- no-trade reason distribution;
- top active signals.

Do not expose full realtime quote/bar/option-chain internals by default.

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

Future purpose: summarize storage lifecycle posture for Current Status and Alerts.

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

## First Implementation Target

The first dashboard runtime slice should prioritize:

1. Current Status;
2. Alerts and Exceptions;
3. Tasks;
4. Models summary;
5. Registry Dictionary / hover profiles.

Realtime Trading Signals and Trading Performance Summary should remain parked until mature evidence exists.

## Storage Home

Dashboard summary/read-model outputs belong in `trading-storage` as the durable/materialized home. This keeps the dashboard read-only and prevents it from directly coupling to raw manager/model/data/execution internals.

Responsibilities split as follows:

- `trading-storage` owns physical placement, retention, backup, restore, archive, materialized snapshot history, and lifecycle treatment for dashboard summaries.
- `trading-manager`, `trading-model`, `trading-execution`, `trading-data`, and `trading-storage` each own the semantics of summaries for their domains.
- `trading-dashboard` owns presentation only.
- `trading-manager` remains the registry/governance route for shared contract names before implementation.

The companion storage-side design contracts are `trading-storage/docs/96_dashboard_read_models.md` and `trading-storage/docs/97_dashboard_summary_layout.md`. Shared contract names are registered through `trading-manager` migration `344_register_dashboard_read_model_contracts.sql`.
