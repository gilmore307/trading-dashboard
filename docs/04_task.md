# Task

## Active Tasks

- Historical Task Progress current content is being completed before opening broader dashboard pages: Tasks now focuses on a filtered, month-grouped historical child-task list. The default view shows current `Now` work when available and otherwise falls back to the latest completed period, with filters for month, layer, status, task/work type, worker, and target; Month and Target are typed selectors, low-cardinality filters remain dropdowns, and filter choices are ordered by month/layer/time/process sequence rather than alphabetically. Rows are window-rendered for broad historical views and can expand to show task detail/progress, including generated/started/ended/status-updated timestamps when available. Model-specific month/stage/progress/coverage cards live under Models.
- First website slice is implemented: Vite + React + TypeScript renders public read-only Current Status, Tasks, Data, Models, and Diagnostics pages from storage read models plus an allowlisted read-only downloaded-data table API. The left navigation remains the only page-switching entry point, with read-only manual refresh and WebSocket streaming with HTTP fallback polling for read models. Diagnostics is last in navigation and summarizes errors/status in a severity-filtered table rather than acting as a troubleshooting workbench.
- Dashboard primarily consumes storage-hosted summaries; the Data page is the narrow exception and only exposes explicitly allowlisted read-only downloaded source/feature tables, never arbitrary SQL or manager control-plane tables. Current Status now includes a Runtime Throughput card: 3 month-ingest + 1 model-worker topology, six-month fold cadence, completion rate, peak completions, observation window, and idle/blocked decision count. The resource card labels free disk as Available Storage. Provider-thread settings remain subordinate implementation detail rather than the primary card content.
- Dashboard web service template is implemented in `deploy/systemd/trading-dashboard-web.service`; host installation/start remains an operational deployment step, not a dashboard-originated workflow action.
- As future website slices consume more original source outputs, update the Dashboard Data/source-output inventory in the same slice so the freshness/audit view stays complete. Dashboard Data must distinguish source artifact write time from dashboard read-model refresh time, and must label heartbeat vs event-driven freshness behavior.

## Historical-Training Todo Status

- No dashboard tasks are required for no-broker historical training.
- Current training evidence can be inspected through manager/storage/model CLI outputs and docs until a first dashboard implementation slice is explicitly accepted.

## Not Current Scope

These items are intentionally outside the current no-broker historical-training run and must not be treated as active dashboard work items:

- broad multi-page dashboard runtime beyond the first Historical Modeling slice;
- arbitrary SQL consoles, write-capable table views, raw receipt browsers, daemon implementation controls, or unallowlisted maintenance internals;
- new read-model surfaces beyond the accepted initial/parked set before their presentation contract, storage layout, and registry route are accepted;
- dashboard-originated requests, provider calls, model activation, broker execution, or account mutation.

## Recently Accepted

- Added the first visible website slice: Vite + React + TypeScript renders `historical_task_progress_summary` as a chart-first Historical Task Progress page with cards, progress bar, stage distribution, coverage placeholder, next action, blocker, and diagnostics.
- Added the first dashboard read adapter: `src/trading_dashboard/read_models.py` and `scripts/read_models/read_latest_dashboard_read_model.py` read storage-hosted `latest.json` summaries, starting with `historical_task_progress_summary`, without raw internal table access or side effects.
- Added the first refreshable dashboard read model: `trading-manager` builds `historical_task_progress_summary` from read-only scheduler/status evidence, and `trading-storage` can refresh/materialize it through a storage-owned wrapper plus reviewed systemd service/timer templates. Dashboard UI remains future work.
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

## Current Status infrastructure slice

- Current Status now consumes `current_system_status_summary` for server/API/systemd-service/read-model-refresh posture.
- Historical task execution list remains under Tasks via `historical_task_progress_summary`; Layer 3+ target-specific rows show and filter by target symbol. The Data page sits directly below Tasks and exposes approved downloaded-data tables such as bars/events/features with table selection, global search, per-column filters, sorting, and pagination. Model-specific workflow progress/coverage lives under Models using the same storage-hosted summary until a dedicated model read model is accepted. Diagnostics remains a final, severity-filtered error/status table with user-facing error numbers and without read-model/evidence plumbing.
- The page preserves the left-sidebar-only navigation rule and read-only dashboard boundaries.
