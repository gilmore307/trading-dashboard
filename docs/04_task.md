# Tasks

## Active Tasks

- Current accepted read-model route is `storage/06_dashboard_cache/read_models/<contract_type>/latest.json`, served through `/api/read-models/<contract_type>/latest` and `/ws/read-models/<contract_type>/latest`.
- Current public storage refresh set is `current_system_status_summary`, `historical_task_progress_summary`, `event_calendar_summary`, `realtime_signal_summary`, and `execution_realtime_trading_runtime_status`.
- Historical Task Progress current content is implemented: Tasks now focuses on a filtered, month-grouped historical child-task list. The default view shows current `Now` work when available and otherwise falls back to the latest completed period, with filters for month, layer, status, task/work type, worker, and target; Month and Target are typed selectors, low-cardinality filters remain dropdowns, and filter choices are ordered by month/layer/time/process sequence rather than alphabetically. Rows are window-rendered for broad historical views and can expand to show task detail/progress, including generated/started/ended/status-updated timestamps when available. Model-specific month/stage/progress/coverage cards live under Models.
- Realtime Signals now consumes `realtime_signal_summary` from storage. The page shows monitor mode/state, cycle and provider-observation counts, shadow decision-input readiness, handoff readiness, safety-boundary flags, and visible gaps. If no execution realtime monitor receipt exists yet, it displays a safe `not_started` state instead of a placeholder or fabricated metrics.
- Vite + React + TypeScript renders public read-only Current Status, Tasks, Calendar, Data, Models, Realtime Signals, and Diagnostics pages from storage read models plus an allowlisted read-only data/model-output table API. The left navigation remains the only page-switching entry point, with read-only manual refresh and WebSocket streaming with HTTP fallback polling for read models. Diagnostics is last in navigation and summarizes errors/status in a severity-filtered table rather than acting as a troubleshooting workbench.
- Dashboard primarily consumes storage-hosted summaries; the Data page is the narrow exception and only exposes explicitly allowlisted read-only source, feature, and main model-output tables, never arbitrary SQL, manager control-plane tables, dataset/promotion tables, or diagnostics internals. Current Status now includes a Runtime Throughput card: 3 month-ingest + 1 model-worker topology, six-month fold cadence, completion rate, peak completions, observation window, and idle/blocked decision count. The resource card labels free disk as Available Storage. Provider-thread settings remain subordinate implementation detail rather than the primary card content.
- Calendar consumes `event_calendar_summary` from storage. The page shows upcoming/recent events, source-artifact evidence counts, Trading Economics refresh state, connected calendar families, and explicit `not_connected` gaps for exchange holidays/early closes, option expiry windows, and index rebalance windows.
- Dashboard web service template is implemented in `deploy/systemd/trading-dashboard-web.service`; host installation/start remains an operational deployment step, not a dashboard-originated workflow action.
- As future website slices consume more original source outputs, update the Dashboard Data/source-output inventory in the same slice so the freshness/audit view stays complete. Dashboard Data must distinguish source artifact write time from dashboard read-model refresh time, and must label heartbeat vs event-driven freshness behavior.

## Outside Boundary

These items are intentionally outside the current dashboard boundary and must not be treated as active dashboard work items:

- arbitrary SQL consoles, write-capable table views, raw receipt browsers, daemon implementation controls, or unallowlisted maintenance internals;
- new read-model surfaces before their presentation contract, storage layout, and registry route are accepted;
- dashboard-originated requests, provider calls, model activation, broker execution, or account mutation.

## Proposed Primary Tabs

- Current Status — high-level server/resource/API/service/scheduler/realtime posture, with alert summary.
- Alerts and Exceptions — owner-actionable unresolved issues, severity, impact, and suggested next action.
- Tasks — historical modeling and realtime trading subtabs, focused on owner-facing progress/blockers.
- Models — ten layer subtabs for parameters, version/update history, performance, and promotion posture.
- Realtime Trading Signals — reads `realtime_signal_summary` and shows safe empty state until monitor receipts exist.
- Trading Performance Summary — parked until live trading produces stable performance evidence.
- Registry Dictionary — read-only searchable explanation surface for accepted fields, terms, statuses, contracts, configs, and scripts.

Registry-backed field profiles remain contextual hover/detail explanations for visible fields and can link into the Registry Dictionary.

## Current Status infrastructure slice

- Current Status now consumes `current_system_status_summary` for server/API/systemd-service/read-model-refresh posture.
- Historical task execution list remains under Tasks via `historical_task_progress_summary`; Layer 3+ target-specific rows show and filter by target symbol. The Data page sits directly below Tasks and exposes approved source, feature, and main model-output tables with table selection, global search, per-column filters, sorting, and pagination. Event rows surface `event_type` first, backed by raw `event_category_type`, so owners can distinguish abnormal activity now and future news/earnings/macro categories when those sources are ingested. Model-specific workflow progress/coverage lives under Models using the same storage-hosted summary until a dedicated model read model is accepted. Diagnostics remains a final, severity-filtered error/status table with user-facing error numbers and without read-model/evidence plumbing.
- The page preserves the left-sidebar-only navigation rule and read-only dashboard boundaries.
