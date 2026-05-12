# Task

## Active Tasks

- First website slice is implemented: Vite + React + TypeScript renders a read-only Tasks / Historical Modeling page from `historical_task_progress_summary_v1`.
- Dashboard continues consuming storage-hosted summaries rather than raw internals.

## Historical-Training Todo Status

- No dashboard tasks are required for no-broker historical training.
- Current training evidence can be inspected through manager/storage/model CLI outputs and docs until a first dashboard implementation slice is explicitly accepted.

## Not Current Scope

These items are intentionally outside the current no-broker historical-training run and must not be treated as active dashboard work items:

- broad multi-page dashboard runtime beyond the first Historical Modeling slice;
- primary pages exposing maintenance internals, model intermediate artifacts, manager request payloads, run manifests, ready signals, raw receipts, or daemon implementation details;
- new read-model surfaces beyond the accepted initial/parked set before their presentation contract, storage layout, and registry route are accepted;
- dashboard-originated requests, provider calls, model activation, broker execution, or account mutation.

## Recently Accepted

- Added the first visible website slice: Vite + React + TypeScript renders `historical_task_progress_summary_v1` as a chart-first Historical Task Progress page with cards, progress bar, stage distribution, coverage placeholder, next action, blocker, and diagnostics.
- Added the first dashboard read adapter: `src/trading_dashboard/read_models.py` and `scripts/read_models/read_latest_dashboard_read_model.py` read storage-hosted `latest.json` summaries, starting with `historical_task_progress_summary_v1`, without raw internal table access or side effects.
- Added the first refreshable dashboard read model: `trading-manager` builds `historical_task_progress_summary_v1` from read-only scheduler/status evidence, and `trading-storage` can refresh/materialize it through a storage-owned wrapper plus reviewed systemd service/timer templates. Dashboard UI remains future work.
- Registered the storage-side dashboard read-model materializer through `trading-manager`: producer-supplied summaries can now be validated and materialized by `trading-storage` into snapshot/latest/schema/index files.
- Registered the dashboard summary/read-model contract names through `trading-manager` and accepted the initial storage physical layout/validation boundary in `trading-storage/docs/97_dashboard_summary_layout.md`.
- Closed the current presentation-boundary phase in `docs/07_dashboard_closeout.md`: downstream-only display role, provenance-preserving expectation, no dashboard-originated trading actions, and deferred implementation-layout policy are accepted. No dashboard runtime, provider call, manager dispatch, model activation, broker execution, or account mutation is enabled by this closeout.
- Created initial `trading-dashboard` docs spine and repository boundary.
- Added initial `.gitignore` for local environments, generated outputs, logs, and secrets.

## Proposed Primary Tabs

- Current Status — high-level server/resource/API/service/scheduler/realtime posture, with alert summary.
- Alerts and Exceptions — owner-actionable unresolved issues, severity, impact, and suggested next action.
- Tasks — historical modeling and realtime trading subtabs, focused on owner-facing progress/blockers.
- Models — eight layer subtabs for parameters, version/update history, performance, and promotion posture.
- Realtime Trading Signals — parked until realtime components are stable enough to provide meaningful signal summaries.
- Trading Performance Summary — parked until live trading produces stable performance evidence.
- Registry Dictionary — read-only searchable explanation surface for accepted fields, terms, statuses, contracts, configs, and scripts.

Registry-backed field profiles remain contextual hover/detail explanations for visible fields and can link into the Registry Dictionary.

## First Implementation Candidate

The first runtime slice should target only:

1. Current Status;
2. Alerts and Exceptions;
3. Tasks;
4. Models summary;
5. Registry Dictionary / hover profiles.

Realtime Trading Signals and Trading Performance Summary remain parked until mature realtime/trading evidence exists.
