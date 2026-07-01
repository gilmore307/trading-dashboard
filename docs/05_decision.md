# Decisions


## D001 - Dashboard is downstream presentation

Date: 2026-04-25

### Context

The trading platform needs `trading-dashboard` to have a clear owner boundary before implementation begins.

### Decision

The dashboard displays existing outputs and evidence; it does not create data, strategy, model, or execution truth.

### Rationale

A narrow component boundary prevents hidden coupling and keeps cross-repository work reviewable.

### Consequences

- Implementation work must stay inside the accepted component role.
- Shared names and contracts must route through `trading-manager`.
- Generated outputs and secrets must stay out of Git.


## D002 - Dashboard must preserve provenance

Date: 2026-04-25

### Context

The trading platform needs `trading-dashboard` to have a clear owner boundary before implementation begins.

### Decision

Views should retain references to source artifacts, manifests, and ready signals whenever possible.

### Rationale

A narrow component boundary prevents hidden coupling and keeps cross-repository work reviewable.

### Consequences

- Implementation work must stay inside the accepted component role.
- Shared names and contracts must route through `trading-manager`.
- Generated outputs and secrets must stay out of Git.


## D003 - No trading actions from dashboard without contract

Date: 2026-04-25

### Context

The trading platform needs `trading-dashboard` to have a clear owner boundary before implementation begins.

### Decision

Dashboard-triggered mutations or execution actions require a future explicit contract and acceptance path.

### Rationale

A narrow component boundary prevents hidden coupling and keeps cross-repository work reviewable.

### Consequences

- Implementation work must stay inside the accepted component role.
- Shared names and contracts must route through `trading-manager`.
- Generated outputs and secrets must stay out of Git.

## D004 - Current presentation-boundary phase is closed

Date: 2026-05-09
Status: Accepted

### Context

`trading-dashboard` now has a clear downstream-only repository boundary, provenance-preserving display expectation, and explicit prohibition on dashboard-originated trading actions without a future accepted contract.

### Decision

Close the current presentation-boundary phase. `docs/10_dashboard_acceptance.md` is the authoritative boundary document.

Dashboard implementation work must stay read-only and consume reviewed storage-hosted read models.

### Consequences

- `trading-dashboard` remains a read-only presentation consumer unless a future mutation contract is explicitly accepted.
- This acceptance does not enable dashboard runtime, provider calls, manager dispatch, model activation, broker execution, or account mutation.
- New dashboard implementation must start from reviewed manager/storage output refs and preserve provenance.

## D007 - Temporal Explorer page consumes Temporal Explorer summary

Date: 2026-05-26
Status: Superseded by D032

### Context

The dashboard calendar route is a Temporal Explorer, not a raw event browser. The chart viewport, scheduled/released/news substrate, replay/model lanes, and explicit source gaps must align on one shared time axis. Market state is summarized on Status so Temporal Explorer can stay focused on time-aligned chart and event inspection.

### Decision

Add a read-only Temporal Explorer page backed by `temporal_explorer_summary` from `trading-storage`. The primary chart is a TradingView-style K-line surface over the current model-group replay window: selected ETF, selected frame, M06 accepted event markers, and visible tick labels all live around the primary chart axis. The page also shows lower subcharts such as volume and accepted-event density, symbol/frame selectors, and selected-unit event details. The former narrow event-calendar summary is no longer part of the public dashboard surface.

### Consequences

- Dashboard Temporal Explorer reads `/api/read-models/temporal_explorer_summary/latest` and `/ws/read-models/temporal_explorer_summary/latest`.
- The page performs no provider calls, SQL writes, model activation, broker execution, or account mutation.
- Early closes, chart bars, replay state, model event markers, and M06 accepted event markers remain visible gaps until accepted source producers populate them. Scheduled events, event results, and news index rows may be populated substrate tables without becoming chart markers.


## D005 - Dashboard is an owner-facing summary, not an internal maintenance console

Date: 2026-05-12
Status: Accepted

### Context

Chentong clarified that the website exists to summarize system, model, signal, and trading-performance questions for him. System-maintenance details and model intermediate products are mostly internal machinery and should not become normal website content.

### Decision

The dashboard primary navigation is grouped by user intent:

- General — Status, Definitions, and Diagnostics.
- Historical Models — Tasks, Data, Models, Replay Performance, Replay Decisions, Replay Operations, and Temporal Explorer.
- Realtime — Realtime Signals and Trading Performance.

The dashboard should be simple, clear, chart-first, and text-light. Internal artifacts, manifests, ready-signal rows, request payloads, daemon internals, raw logs, and model intermediate products are hidden by default. They may appear only in advanced diagnostic drilldowns when needed to explain a visible owner-facing issue.

Registry-backed field profiles remain useful as contextual hover/detail explanations for fields already shown on the dashboard. Definitions is read-only explanation for system vocabulary and must not become a registry editor or maintenance console. Diagnostics is the owner-facing place for visible system errors and degraded states.

### Consequences

- `docs/20_information_architecture.md` owns the initial page structure and visibility rules.
- Implementation must not turn `trading-dashboard` into a general artifact browser, registry editor, maintenance console, or workflow controller. Definitions is read-only explanation, and Diagnostics is an owner-facing error/status summary.
- Implementation slices should consume owner-facing summary/read-model outputs, not raw internal control-plane tables as primary UI content.
- Advanced diagnostics must stay issue-focused and secondary.


## D006 - Dashboard consumes owner-facing read models, not raw internals

Date: 2026-05-12
Status: Accepted

### Context

The dashboard could accidentally become a complex internal-table UI if it reads directly from manager requests, run manifests, artifact refs, ready-signal rows, raw receipts, daemon internals, execution adapter records, storage lifecycle internals, or raw registry SQL history. Chentong wants a summary surface that explains system/model/trading posture and highlights actionable problems, not an internal maintenance console.

### Decision

Dashboard pages must consume owner-facing summary/read-model contracts materialized in `trading-storage`. `docs/30_dashboard_read_models.md` owns the dashboard-side contract set, and `trading-storage/docs/40_dashboard_read_models.md` owns the storage-home boundary.

The current public refresh set is:

- `current_system_status_summary`;
- `historical_task_progress_summary`;
- `realtime_signal_summary`;
- `execution_realtime_trading_runtime_status`.

Other dashboard read-model contracts remain parked until their producer, storage layout, and presentation route are accepted.

Advanced diagnostics may only be entered from a visible owner-facing issue such as an alert, blocked task, model blocker, degraded signal, performance anomaly, or stale dashboard data warning. There must not be a global artifact browser, receipt browser, log viewer, control-plane table browser, raw registry-row browser, or daemon internals explorer as a primary surface.

### Consequences

- Implementation should build against storage-hosted summary/read-model outputs, not raw control-plane tables.
- Raw evidence remains available only as issue-focused diagnostic support.
- Storage lifecycle appears through Status and Alerts unless it becomes a daily owner-facing concern.
- Realtime Signals and Trading Performance must distinguish unavailable/shadow/paper/live states clearly and must not fabricate mature metrics before evidence exists.


## D007 - Dashboard summaries live in trading-storage

Date: 2026-05-12
Status: Accepted

### Context

Chentong clarified that the dashboard summary/read-model outputs should live in the storage repository. This preserves the dashboard as a read-only presentation layer and gives durable summaries a clear persistence, retention, backup, restore, and lifecycle owner.

### Decision

`trading-storage` is the durable/materialized home for dashboard summary/read-model outputs. The dashboard reads these storage-hosted summaries instead of coupling directly to raw manager, model, data, execution, registry, daemon, receipt, or artifact internals.

Semantic ownership does not move to storage: task/scheduler/promotion summary semantics remain with `trading-manager`; model metric semantics remain with `trading-model`; realtime/execution semantics remain with `trading-execution`; provider/data semantics remain with `trading-data`; storage owns persistence/lifecycle and storage-health summary semantics.

### Consequences

- `trading-dashboard` remains presentation-only and read-only.
- `trading-storage` defines the initial physical layout and validation boundary in `trading-storage/docs/41_dashboard_summary_layout.md`.
- Shared summary contract names are governed through `trading-manager` before cross-repository implementation depends on them.
- Dashboard implementation should request/consume storage-hosted summaries rather than raw component internals.


## D008 - Dashboard read adapter consumes storage current files

Date: 2026-05-12
Status: Accepted

### Context

`historical_task_progress_summary` has a manager-owned semantic producer and a storage-owned refresh/materialization wrapper. The dashboard consumes this accepted summary without becoming a workflow controller, raw artifact browser, or storage writer.

### Decision

The dashboard read adapter reads storage-hosted dashboard read-model current files:

- importable module: `src/trading_dashboard/read_models.py`;
- executable helper: `scripts/read_models/read_latest_dashboard_read_model.py`;
- accepted storage route: `storage/06_dashboard_cache/read_models/<contract_type>.json`.

The adapter reads only accepted `storage/06_dashboard_cache/read_models/<contract_type>.json` summaries, validates the common dashboard envelope shape, and projects the payload into a UI-ready dictionary. It does not query raw manager/model/data/execution/storage internals and does not perform provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes.

### Consequences

- Future UI/runtime pages should consume this adapter boundary or a successor with the same storage-hosted read-model discipline.
- Missing current read-model files are surfaced as read-adapter errors rather than silently fabricating dashboard values.
- Additional dashboard contracts can reuse the adapter after their semantic producer and storage materialization path are accepted.

## D009 - Website runtime is read-only over storage read models

Date: 2026-05-12
Status: Accepted

### Context

The read-model pipeline is concrete enough for a visible product that follows the accepted outline and can be reviewed for practical UI feedback.

### Decision

The website/runtime uses Vite + React + TypeScript and keeps page content read-only.

Dashboard pages consume read models through `/api/read-models/<contract_type>/latest` and `/ws/read-models/<contract_type>/latest`, backed by `trading-storage/storage/06_dashboard_cache/read_models/<contract_type>.json`. The left navigation is the only page-switching entry point; main content stays informational, while manual refresh, read-only WebSocket streaming, HTTP fallback polling, and in-view diagnostic expansion remain read-only controls.

### Consequences

- This is a visible website slice, not a workflow-control surface.
- No dashboard-originated provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes are allowed.
- Future pages should reuse storage-hosted dashboard read models and avoid raw internal tables as primary UI input.

## D010 - Status is infrastructure status, not model progress

Date: 2026-05-12
Status: Accepted

### Context

Chentong clarified that the Status page should show server/API/system-service infrastructure posture, including dashboard refresh/read timestamps and status. It should not be another model-progress page.

### Decision

Status consumes `current_system_status_summary`. The summary is storage-owned and covers server resources, dashboard API routes, systemd service/timer state, dashboard read-model freshness, and refresh cadence. Model workflow progress stays on Tasks through `historical_task_progress_summary`.

The left navigation remains the only page-switching entry point. Main Status content is informational and read-only.

### Consequences

- Dashboard Status does not query raw manager/model/data/execution internals.
- Infrastructure status is published through storage-hosted read models before the dashboard renders it.
- WebSocket streaming remains read-only and streams storage-hosted snapshots only.

## D011 - Status uses public-facing names

Date: 2026-05-12
Status: Accepted

### Context

Chentong clarified that Status should be understandable to someone who does not know the internal OpenClaw/trading repository layout. Internal route paths, systemd unit names, storage contract names, and component identifiers should not be visible in the primary Status page.

### Decision

The Status UI presents plain-language labels over the accepted dashboard summary payload. Examples include `System Health Summary`, `Task Progress Summary`, `Historical Training Automation`, `Dashboard Refresh Schedule`, and `Dashboard Refresh Worker` instead of internal contract paths, systemd unit names, or storage file identifiers.

The underlying read-model contracts and runtime routes may remain implementation details, but the public page should show generic user-facing names and action-oriented health language.

### Consequences

- The Status page remains backed by storage-hosted dashboard summaries, but it does not expose internal paths or unit names in primary UI text.
- Error/loading copy should describe dashboard status availability, not read-model file paths or refresh wrapper commands.
- Future Status-page additions should add a public presentation label instead of rendering raw internal identifiers.

## D012 - Server resources lead Status

Date: 2026-05-13
Status: Accepted

### Context

Chentong clarified that Status should begin with immediately useful server resource posture rather than Linux load-average internals or explanatory copy.

### Decision

Status leads with a `Server Resources` card showing public-facing resource metrics: CPU usage, memory usage, network download rate, and network upload rate. The older load-average detail is not shown in the primary card; server state uses plain outcome language such as `Online` and `Running normally`.

### Consequences

- Status starts with live resource posture before service/data freshness sections.
- Resource metrics remain read-only observations from the storage-owned status summary.
- Future resource additions should use plain operational labels rather than kernel/internal field names.


## D013 - Status exposes provider API connections with public labels

Date: 2026-05-13
Status: Accepted

### Context

Chentong asked for an API card showing provider APIs such as Alpaca, OKX, and ThetaData with connection/status information. The page should still avoid exposing internal route paths, secret paths, or low-level implementation details.

### Decision

Status shows an `API Connections` card with public provider API names and plain status labels, such as `Alpaca Market Data API`, `OKX Market Data API`, and `ThetaData Options API`. The default dashboard read model reports local configuration/runtime availability only and does not call providers.

### Consequences

- Provider API readiness is visible as part of Status without leaking route templates or secret material.
- Live provider connectivity checks, if added later, need a separate bounded read-only approval path.


## D014 - Status groups providers and services, then lists source outputs

Date: 2026-05-13
Status: Accepted

### Context

Chentong asked for provider API status and Background Services to share one row, while Dashboard Data should be its own row. Dashboard Data should list the original script/model/task outputs that feed the dashboard, not derived dashboard summary files.

### Decision

Status renders Server Resources first, then a Runtime Throughput card. The card shows the 1 month-ingest + 1 model-worker topology, 18-month fold window, 12-month fold step, completion rate, peak completion burst, observation window, and idle/blocked decision count. API Connections and Background Services remain side by side. Dashboard Data is a full-width panel below them and lists original source outputs such as scheduler state, scheduler decision log, active workflow state, stage coverage output, and stage-run output with each output's last updated timestamp. Aggregation/sanitization is allowed as an adapter/cache step, but it is not the canonical source of truth.

As future website pages, adapters, or read-model slices consume additional original source outputs, the Dashboard Data source-output inventory must be updated in the same development slice. Omitting a newly consumed raw source output from this list is a freshness/auditability contract gap, even if the derived dashboard JSON is already refreshed.

### Consequences

- Infrastructure/service posture stays compact in one row.
- Dashboard input freshness is easier to audit because source output freshness is visible.
- Public labels remain preferred over internal storage paths.
- Derived dashboard JSON should be described as sanitized/cache presentation, not as a new source file.
- Future website development must keep source-output visibility synchronized with the actual raw/source artifacts feeding each visible dashboard surface.

## D015 - Tasks is operational; Models is evaluation-first

Date: 2026-05-13
Status: Accepted

### Context

Chentong clarified that the Tasks page should answer what work is being performed at a finer operational level, such as data acquisition or feature generation, rather than primarily saying which model layer is active. The previous Current month, Active stage, Historical Modeling Progress, Latest Stage Coverage, and Task Progress Summary presentation felt too model-specific for Tasks.

### Decision

The left navigation remains fixed. Tasks renders a storage-hosted task timeline listing past, current, and future historical stages with their phase, model, status, timestamps, receipts/blockers, and reason. Each task detail exposes generated, started, ended, and status-updated timestamps when available so the owner can tell whether a task is actively moving or has been sitting unchanged. Models owns model evaluation presentation: tab `0` is the model-group pipeline and owns version comparison, promotion identity, ranking/calibration, decision-variable, and feature-space diagnostics; tabs `M01`-`M06` show individual component models through chart/table-first evidence dossiers covering model claim, required evidence, validity status, model specification, and optimization targets. Historical replay economics move to Replay. Task states, task blockers, workflow progress, safety gates, receipts, and operational debug timelines stay in Tasks/Diagnostics. The generic `Task Progress Summary` card is removed from page content.

### Consequences

- Tasks is list-first and operational-stage-first.
- Models consumes `model_readiness_summary` and `model_promotion_posture_summary` for model-group version comparison, promotion identity, ranking/calibration, decision-variable, and feature-space diagnostics. `execution_realtime_trading_runtime_status` may identify a group active pointer. Model subtabs are not part of the current dashboard route.
- Dashboard remains read-only and consumes storage-hosted summaries rather than workflow checkpoint internals directly.

## D016 - Task list defaults to current work and exposes filters

Date: 2026-05-13
Status: Accepted

### Context

After Tasks became list-first, the full historical workflow list still showed too many rows at once. Chentong clarified that the top of Task List should include filters for layer, status, and task/work type such as Data Acquisition, and the default should show only the current `Now` task.

### Decision

Task List renders filter controls above the list. Filters cover layer, task state/status (`Now`, `Past`, `Future`, `Failed`, `Skipped`), and task/work type (`Data Acquisition`, `Feature Generation`, etc.). The default status filter is `Now`; layer and task/work type default to all. A reset action returns the view to the current-work default.

### Consequences

- Tasks stays operational and compact instead of showing every past/current/future row by default.
- The underlying storage-hosted timeline remains complete; filtering is a read-only presentation concern.
- Future task-list additions should preserve the current-work default unless a stronger owner-facing reason exists.

## D017 - Task rows are finest child tasks grouped by month

Date: 2026-05-13
Status: Accepted

### Context

Chentong clarified that the task list should display the finest child tasks so completed and incomplete states are meaningful. Historical months such as 2016-01 and 2016-02 are useful grouping/work-window context, not the same visible task row. Chentong also asked for expandable task details, especially for the current task's progress.

### Decision

Task List treats each historical training row as `fold/period + layer + operational stage/work type`. Rows are grouped by fold period, still filterable by period/layer/status/task type/target, and each row has a read-only details toggle. Source/feature stages from 12+3+3 walk-forward folds stay on the fold row and expose month child partitions in detail. Model-group replay rows use canonical phase labels and keep the training fold as `month`, with the replay/test window exposed in task detail. Public task numbers are continuous display sequence numbers assigned after chronological fold, layer, and workflow-stage sorting; `task_uid` remains the durable progress/evidence identity. Expanded details show task identity, status/reason, latest execution result when attached, evidence count/refs, blockers, and progress only when there is real progress evidence such as row counts, month counts, elapsed/expected time, or an active progress file. Worker labels are not shown and worker filtering is not supported in Tasks because one fold can be executed by multiple internal provider/ingest lanes. The task timeline must not expose the current incomplete fold as a Ready task before the final month of that fold has completed in `America/New_York`.

### Consequences

- Completed/failed/current/future states apply to the finest child-task row instead of a broad month or model-layer label.
- Month grouping keeps 2016-01/2016-02 style work windows understandable without collapsing them into one task.
- Detail expansion remains presentation-only over storage-hosted, manager-sanitized read-model fields.

## D018 - Completed historical months remain visible in Tasks

Date: 2026-05-13
Status: Accepted

### Context

After month grouping was added, the dashboard still showed only the active month because the manager read model emitted the active workflow plan/checkpoint only. That hid completed historical months even though the scheduler daemon had durable completed-month state and month-specific workflow state files.

### Decision

Task List keeps the default `Now` status filter, but the read model includes completed historical workflow-state months before the active month. The UI adds an explicit Month filter so operators can inspect prior month groups without treating the month itself as the task row.

### Consequences

- Prior completed months are visible as `Past`/completed child-task rows when the status filter is widened.
- The active month remains the only source of a `Now` row and latest execution/progress attachment.
- Month remains a grouping/filter dimension, not the task identity by itself.

## D019 - Dashboard Data distinguishes heartbeat freshness from event freshness

Date: 2026-05-13
Status: Accepted

### Context

Chentong noticed Dashboard Data source timestamps looked stale even when the dashboard summary itself was refreshing. Investigation showed two separate cases can look identical if the UI only says "updated": heartbeat files should refresh continuously, while decision/workflow/coverage/run artifacts update only when scheduler decisions or stage progress occur. A separate bug also made Active Workflow State point at a stale unqualified workflow-state file instead of the active month-specific workflow state.

### Decision

Dashboard Data must describe source artifact write times as distinct from dashboard read-model refresh time. Source-output rows expose a freshness class: `heartbeat` for continuously refreshed scheduler state, and `event_driven` for scheduler decision/workflow/stage artifacts that update only when progress occurs. The Active Workflow State row resolves the active month-specific workflow state from scheduler state rather than the unqualified workflow-state file.

### Consequences

- Event-driven timestamps are not automatically presented as dashboard refresh failures.
- Stale heartbeat timestamps should direct attention to service/runtime health.
- Dashboard Data stays an audit/freshness surface for source artifacts, not a raw artifact browser.
- Active workflow freshness follows the actual current month.

## D020 - Task filters use chronological and workflow order

Date: 2026-05-13
Status: Accepted

### Context

Chentong asked that Status and Task filter choices appear in time/process order instead of arbitrary alphabetical order. Alphabetical ordering made the Task selector less useful because workflow phases such as data acquisition, feature generation, model generation, evaluation, promotion review, and maintenance should be read in execution sequence.

### Decision

Task List filter options are ordered by domain sequence. Months sort chronologically, layers sort numerically, statuses sort by task timeline posture (`Past`, terminal exceptions, `Now`, then `Future`), and task choices sort model-numbered work such as M01-M06 before model-group lifecycle work such as replay, evaluation, promotion, and maintenance. Generic workflow task types still sort by historical workflow order after those model-specific choices: data acquisition, feature generation, model generation, model evaluation, promotion review preparation, then maintenance. Unknown future values remain visible after the known sequence.

### Consequences

- Operators can scan filters in the same order as the historical workflow.
- The default Status filter remains `Now`; only the dropdown option order changes.
- New model-numbered or task/work-type values should be assigned an explicit order when they become first-class workflow phases.

## D019 - Dashboard web service is presentation-only

Date: 2026-05-14
Status: Accepted

### Context

The dashboard needs a resident browser-serving process instead of ad hoc `npm run dev` sessions, while preserving the dashboard boundary as read-only presentation over storage-hosted read models.

### Decision

`deploy/systemd/trading-dashboard-web.service` is the accepted host service template. It builds the Vite UI before start and serves it on the reviewed Vite preview port `5173` with `TRADING_DASHBOARD_STORAGE_ROOT` pointed at `trading-storage/storage`. The Vite read-model plugin serves the same read-only HTTP and WebSocket latest-summary routes in both dev and preview modes.

### Consequences

- Dashboard service startup may rebuild `dist/`, but the running dashboard still does not publish tasks, dispatch manager work, call providers, activate models, submit broker orders, mutate accounts, or write storage read models.
- Storage remains the owner of dashboard read-model materialization and refresh cadence.
- Host installation/restart of the service is an operational deployment action, not a dashboard UI control.

## D021 - Task and status labels use owner-facing semantics

Date: 2026-05-14
Status: Accepted

### Context

M02 and later historical model stages are target-specific, but the Task List only emphasized period, layer, and workflow phase. Status also labeled the free-disk metric as `Storage`, which could be mistaken for total disk, storage service health, or storage lifecycle status. Runtime throughput labels such as `Window`, `Peak burst`, and `Idle / blocked` were also too terse for owner-facing interpretation.

### Decision

Task List rows for target-specific M02+ work show the selected target symbol and include a Target filter. Status labels the disk-space card as `Available Storage`. Runtime throughput cards use fuller labels: `Peak completions`, `Observation window`, and `Idle/blocked decisions`.

### Consequences

- Target-specific modeling work can be filtered and scanned by symbol without exposing raw workflow checkpoint internals.
- Storage capacity presentation is clear that the value is remaining available disk space.
- Throughput cards remain read-only scheduler observations, but their labels better explain what is being counted.

## D022 - Task default view must not look empty when workflow is idle

Date: 2026-05-14
Status: Accepted

### Context

After historical workflow slices complete, the task timeline can contain no `current` rows. A hard default Status filter of `Now` then renders `0 of N child tasks`, which looks broken even though the system is healthy and the rows are completed. Month filter ordering also treated fold ranges as unknown values, placing them after all single-month entries.

### Decision

The default filters now use `Now/latest period`: they show current work when current rows exist, otherwise they fall back to all statuses for the latest completed period instead of rendering either an empty list or the entire multi-year timeline. Month filters parse single months and `YYYY-foldN` fold labels so folds remain chronologically ordered by their start month. Target filter options put concrete symbols before non-targeted panel work.

### Consequences

- An idle/completed workflow still shows useful historical task rows without rendering the entire multi-year timeline by default.
- Twelve-month model folds no longer drift to the bottom of the Month filter.
- Target filtering is easier to scan because concrete symbols appear before broad market/sector rows.

## D023 - High-cardinality task filters are typed selectors and task rows are windowed

Date: 2026-05-14
Status: Accepted

### Context

The task timeline can span thousands of child tasks across historical months and 12+3+3 model folds. Plain dropdowns are workable for low-cardinality dimensions such as Model and Status, but Month and Target become slow to scan as history and target universes grow. Rendering every filtered row at once also wastes browser work when operators choose broad filters such as all months/all statuses.

### Decision

Month and Target filters are typed dropdown selectors: operators can either open a candidate list or type a month/fold/target and commit the nearest matching option while preserving structured filter values. Low-cardinality filters remain ordinary dropdowns. The task list renders through a windowed virtual row list with month headers and task rows, keeping only the visible slice plus overscan mounted in the DOM.

### Consequences

- Operators can jump directly to high-cardinality filter values without introducing an unstructured global search field.
- Broad historical views remain responsive because the browser does not mount every task row at once.
- The dashboard stays read-only and continues filtering only against storage-hosted summary payload fields.

## D024 - Diagnostics is a final summary page, not a troubleshooting workbench

Date: 2026-05-14
Status: Accepted

### Context

Chentong expects to resolve operational errors by talking directly with the agent rather than using the dashboard as an interactive debugging console. The Diagnostics page should therefore not be prominent or behave like an artifact browser.

### Decision

Diagnostics is placed last in the dashboard navigation. Its content is limited to read-only error/warning summary with user-facing error numbers, occurrence time, severity, and handling status. Detailed repair, rerun, provider action, workflow control, and account/broker actions remain outside the dashboard.

### Consequences

- Primary pages stay focused on owner-facing status, tasks, models, and future business surfaces.
- Diagnostics remains useful as a concise error-status report without duplicating agent troubleshooting flows.
- Raw diagnostic references remain summarized/countable evidence rather than a primary browsing interface.

## D025 - Diagnostics uses severity cards and a traceable issue table

Date: 2026-05-14
Status: Accepted

### Context

Diagnostics should support quick agent-facing follow-up, not act as a raw reference browser. Chentong asked for key fields such as error id, occurrence time, and handling state, and for severity cards to filter the summary below. Issue/evidence refs are useful only as handoff pointers for the agent; they are not primary operator actions.

### Decision

Diagnostics defaults to unresolved rows and provides filters for type, current handling status, and severity. Severity filter cards cover All, Critical, Errors, Warnings, and Notices after the type/status filters are applied. The table includes user-facing error number (`ERR-000001` style), severity, category/status/detail, occurred time, Codex/agent auto-repair intervention state, and handling state (`Open`, `Awaiting retry`, `Manual review`, `Closed`, or `No action needed`). For manager agent-error rows, the permanent `ERR-*` ref comes from the server error catalog and must never be regenerated from current UI sort order or filtered row index. Non-catalog diagnostics use non-ERR stable display refs. Issue/evidence/read-model plumbing is hidden from the page because error handling happens through the agent conversation, not the website.

### Consequences

- Operators can scan actionable errors first and leave non-action notices visible but lower priority.
- Agent handoff remains traceable through user-facing error numbers without exposing read-model/evidence plumbing.
- Optional/offline-but-not-needed conditions can be represented as `No action needed` instead of appearing as unresolved failures.
- Resolved rows remain available through filters without changing their permanent error numbers.

## D026 - Data page is an allowlisted read-only data and model-output viewer

Date: 2026-05-15
Status: Accepted

### Context

Chentong wants a Data page under Tasks that brings downloaded/cleaned market data such as bars into the dashboard with table selection, filtering, sorting, and search. This is useful for owner inspection, but the dashboard must not become a raw SQL console, manager-control-plane browser, or mutation surface.

### Decision

Add a `Data` navigation item directly below `Tasks`. The page uses an allowlisted read-only table API for approved `trading_data` source/feature tables and the main `trading_model` layer output tables. It supports table selection, global text search, per-column filters, clickable column sorting, and fixed-size pagination. The browser never accepts arbitrary SQL and the dashboard still performs no manager dispatch, provider call, model activation, broker/account action, or storage read-model write.

### Consequences

- Operators can inspect downloaded bars/events/features and main model outputs without switching to a terminal for common data checks.
- New source, feature, or model-output tables must be explicitly added to the dashboard allowlist before they appear.
- Model dataset, promotion, diagnostics, explainability, config, and manager control-plane tables remain outside the Data page unless a separate read-only surface is accepted.
- The implementation remains presentation-only and bounded to read-only `SELECT` access.

## D027 - Event data table must surface event type first

Date: 2026-05-15
Status: Accepted

### Context

The downloaded event table has an `event_category_type` field, but the generic SQL-column ordering placed it behind internal identifiers. For owner inspection, the first visible event columns should answer what kind of event it is, such as news, earnings, macro, or abnormal activity, before showing raw ids and references.

### Decision

The Data page displays `event_category_type` as the user-facing `event_type` column and places it first for the Event Risk Governor Events table. `information_role_type` is displayed as `information_role`, `scope_type` as `event_scope`, and `source_name` as `event_source`. Raw column names remain available in the column header detail text for traceability.

### Consequences

- The current downloaded event rows visibly show their type as `equity_abnormal_activity`.
- Future event-source ingestion for news, earnings, macro, filings, or other categories should populate the same event-type column rather than adding a separate UI-only category.

## D028 - Replay owns historical replay economics

Date: 2026-05-29
Status: Accepted

### Context

Chentong clarified that Models should focus on model behavior, validity, statistical analysis, feature-space evidence, acceptance thresholds, runtime coefficients, feature importance, and scoring contributions. Replay return, drawdown, cost sensitivity, slice distribution, and trade outcomes are useful, but mixing them into Models made model evaluation look like runtime/P&L reporting.

### Decision

Add dedicated Replay Performance, Replay Decisions, and Replay Operations pages. Replay Performance owns headline trading performance, normalized NAV, and professional performance metrics. Replay Decisions owns replay decision flow, cost sensitivity, slice distribution, monthly replay detail, concrete decision rows, and trade-outcome inspection. Replay Operations owns replay execution graph, component health, operation status, source readiness, and missing-evidence diagnostics. No selection means summary mode across published replay versions. Multiple selections compare only the selected model groups. Selecting exactly one model switches into focus mode with K-line NAV, selected-model diagnostics, and detailed metric cards or ratio visuals instead of forcing mixed-unit statistics into bar charts. Models keeps model-group comparison, promotion identity, ranking/calibration, decision-variable diagnostics, feature-space plots, layer-level acceptance thresholds, and runtime coefficient/feature-importance tables.

### Consequences

- Replay charts and tables are historical replay evidence only; the dashboard still performs no model activation, broker action, or account/position mutation.
- Detailed replay economics should not be duplicated back into Models.
- Concrete replay decisions and decision-result attribution should not be duplicated back into Replay Operations.
- A dedicated replay read model may replace the current `model_promotion_posture_summary` consumption once replay payloads outgrow promotion posture.

## D029 - Replay Decisions owns concrete replay decision drilldown

Date: 2026-06-12
Status: Accepted

### Context

After all folds finished, most model results were poor. Chentong needs to locate where the failure begins by inspecting every concrete decision each component made, not only aggregate replay performance.

### Decision

Add a dedicated Replay Decisions page under Historical Models. It uses the same replay summary/focus structure as the other replay pages and owns decision-version selection, accepted/fill/taken/avoided/missed summaries, score-decile return, threshold-return, cost-sensitivity, decision-slice diagnostics, monthly decision windows, and raw replay decision rows from `/api/replay-decisions`. Replay Operations no longer owns these decision-specific surfaces; it remains reserved for replay execution graph, component health, operation status, source-readiness, and missing-evidence diagnostics when those fields are published.

### Consequences

- Poor fold/model behavior can be traced from aggregate decision summaries down to month-level and row-level decisions in one page.
- Replay Performance stays focused on economic curves and professional performance metrics.
- Replay Operations no longer duplicates decision rows or decision-result attribution.

## D030 - Replay Decisions was component-first with model evidence pivots

Date: 2026-06-17
Status: Superseded by D031

### Context

Replay Decisions needed a clearer decomposition rule: it could either drill primarily through each replay/runtime component decision or through each model layer decision. A model-layer-first page would duplicate Models, blur model validity with replay execution behavior, and hide execution failures such as expression, sizing, gate, fill, or cost decisions that occur after model output is produced.

### Decision

Replay Decisions uses replay/runtime component decisions as the primary hierarchy. Each row should be inspectable as a component trace: component identity, component decision/action/status, score when reported, reason codes, and downstream outcome. Model layer, model surface, and model output references are secondary evidence fields that support filtering, pivoting, and drill-through to Models, but they do not define the primary page structure.

### Consequences

- Replay Decisions answers where the replay execution decision chain began to diverge or fail.
- Models remains the owner for model validity, promotion posture, layer-level diagnostics, feature-space evidence, and statistical metrics.
- Replay decision payloads should publish stable component IDs and model evidence refs together so the UI can answer both "which component decided this?" and "which model output did that component consume?"
- Component runtime health and graph readiness remain under Replay Operations.

## D031 - Replay review splits model-layer decisions, operations, performance, and events

Date: 2026-06-29
Status: Accepted

### Context

Chentong clarified the replay analysis page family after post-replay review artifacts began publishing. Models should evaluate model groups from a machine-learning structure and statistical-validity perspective, while the replay pages should share the same three interaction dimensions: model-group comparison, individual model-group analysis, and Focus/detail drilldown. The previous D030 component-first rule made Replay Decisions and Replay Operations overlap, and it conflicted with the desired view that Replay Decisions should decompose a model group into the six model layers and judge whether each layer's decision was reasonable with point-in-time evidence.

The manager already runs post-replay review before residual event governance. The artifacts include replay review rows, performance summaries, layer/parameter attribution, and event focus proposals. These are the right semantic source for replay analysis, but they should be projected through a dedicated dashboard read model rather than surfaced as raw artifacts or overloaded into `model_promotion_posture_summary`.

### Decision

Add `model_group_replay_review_summary` as the replay-review dashboard read model. The replay page family uses it as the canonical source for post-replay analysis:

- Models answers whether a model group is statistically and structurally credible as machine learning. It owns model architecture, layer purpose, ranking/calibration, AUROC/PR-AUC/Brier/ECE/MCE, confusion/threshold diagnostics, feature-space PCA/PCoA/silhouette, feature/parameter importance, ablation/attribution, uncertainty, integrity, and temporal stability. Replay PnL is not the primary model-validity criterion.
- Replay Performance answers how the model group traded in replay. It owns realized replay economics such as NAV, return, drawdown, volatility, Sharpe/Sortino/Calmar, beta, hit/payoff quality, exposure, replacement benefit, opportunity capture, and regret as trading-performance context.
- Replay Decisions answers whether each model layer made a reasonable decision given the information and candidate set available at the time. It owns chosen action versus best-available outcome labels, model-layer attribution, cause family, failure type, missed alternatives, parameter replay review, and impact/regret. Future returns may be used as post-replay labels, not as decision-time inputs.
- Replay Operations answers whether the replay machinery exposed, routed, computed, and executed the decision correctly. It owns component/surface gaps, option path availability, replacement mechanics, fill status, source readiness, and first-gap component/mechanism evidence.

### Consequences

- D030's component-first Replay Decisions hierarchy is retired. Component-first evidence now belongs under Replay Operations.
- Dashboard pages should consume page-specific projections from `model_group_replay_review_summary`; raw replay review artifacts remain provenance/drilldown evidence.
- The UI must preserve the same row-selection and Focus pattern across Replay Performance, Replay Decisions, and Replay Operations.
- "Best available" language must stay clearly labeled as post-replay/counterfactual review unless the source row proves the alternative was point-in-time knowable.

## D032 - Events absorbs Temporal Explorer as the canonical event page

Date: 2026-06-29
Status: Accepted

### Context

Chentong clarified that the intended Events page is the current time-axis event exploration surface, not a separate replay-only residual-event page. Keeping both Events and Temporal Explorer in navigation creates two competing event routes and hides the canonical event timeline behind a development name.

### Decision

Events is the single public event page. It uses `temporal_explorer_summary` as the primary page contract for chart controls, event density, selected-unit certified event-family markers, and the certified event-family to market-state relationship. Events does not expose substrate cards and does not consume replay residual-event governance.

### Consequences

- The left navigation no longer exposes a separate Temporal Explorer page.
- Temporal Explorer remains the storage/read-model contract name for the timeline summary until a deliberate contract rename is accepted.
- Replay Performance, Replay Decisions, and Replay Operations remain replay-specific pages. Events is the event attention-pool surface for certified event-family markers and their market-session/chart-state context.

## D033 - Task progress uses task-specific live work units

Date: 2026-06-29
Status: Accepted

### Context

Chentong clarified that the Tasks page progress bar must represent the current task's actual completed work over its actual total work. A single internal-stage template such as "task units" hides the real operational shape of different tasks. The Live area also needs to say what is happening now, such as the current feature window, target, source month, or option-source request, not a generic catch-up phrase. Current task logs should be visible without turning the dashboard into a global log browser.

### Decision

For running Tasks rows, `historical_task_progress_summary` should use active worker progress as the primary progress evidence when concrete units are available. Units may differ by task type: source-month requests for acquisition, feature months for feature generation, model rows or split jobs for model generation, replay timestamps/months for replay, and attribution units for review/governance. Internal-stage aggregate progress may remain as parent context, but it must not replace the active task's real work units.

The expanded row detail shows Live only for the current/running task. Live renders the specific `runtime_activity` summary and details from the manager read model. Tasks does not render a separate Logs section; if progress evidence is too coarse, the producer must improve `runtime_activity` rather than attach partial log streams.

### Consequences

- Progress bars are not shown for rows whose only evidence is a non-terminal status placeholder.
- Running task progress can legitimately use different denominators across task types.
- Past and future task rows do not show live/log areas.
- The dashboard remains read-only: it reads sanitized manager/storage summaries and does not expose a global raw log explorer.

## D034 - Replay Decisions uses an explicit M01-M05 layer-quality contract

Date: 2026-06-30
Status: Accepted

### Context

Chentong clarified that Replay Decisions must show whether each replay-time model-layer decision was correct. The macro view should compare model groups by layer-level statistics, while the micro view should decompose one model group's effective M01-M05 decisions. M06 is a post-replay residual-event governance model and must not be included in this decision-correctness surface.

The existing replay review summary exposed attribution counts such as `miss_attribution_layer_counts` and parameter review classes. That evidence can explain failures, but it cannot by itself prove every M01-M05 layer's effective decision or correctness. `performance.layer_differentiation` is coverage/differentiation context, not correctness evidence.

### Decision

Replay Decisions consumes the `review_runs[].replay_decisions_m01_m05` projection from `model_group_replay_review_summary` as its primary page contract:

- macro mode renders five separate layer chapters, one each for M01 through M05; each chapter compares model groups for that layer using effective decision count, scored decision count, coverage count, acceptable rate, harmful-error rate, missed-good rate, mean regret, mean impact, and evidence status;
- micro mode keeps the same five layer chapters for one model group; each chapter owns its layer cards, charts, summary table, and effective layer-decision ledger with timestamp, target, scoring status, correctness class when published, acceptability class when published, regret when published, impact when published, cause family, failure type, chosen decision or observed state, best-available post-replay label when the layer owns an outcome-labelled action, and candidate scope;
- current post-replay review runs must publish dedicated M01-M05 `layer_review_rows`; one replay decision expands to one row per included layer, so a complete run has `decision_row_count * 5` layer review rows;
- M06 is explicitly listed as excluded from the Replay Decisions layer-quality contract;
- future returns remain post-replay labels only and must not be presented as decision-time inputs;
- M01 and M03 may publish diagnostic rows without scored correctness when no layer-specific best-available context/event-state alternative is present. They must not be marked correct or incorrect merely because downstream M04/M05 outcomes are known.

### Consequences

- Replay Decisions no longer uses generic decision-result counts, score-decile curves, threshold-return curves, cost-sensitivity, or slice-distribution panels as its primary content.
- The dashboard may still display missing evidence states; it must not fake M01-M05 correctness from attribution-only fields.
- Replay Operations remains the owner for component/surface/fill/source mechanics, including first-gap component evidence.

## D035 - Replay pages use layer tabs, focus trends, and replay attribution

Date: 2026-06-30
Status: Accepted

### Context

Chentong clarified that Replay Decisions should not force the five model layers into one long mixed page. In single-model-group focus mode, the charts should show how each metric changes over replay time instead of comparing static bars. Chentong also renamed the model-evaluation page from Models to Model Groups and redirected Events away from a generic event timeline toward replay error attribution and event linkage.

### Decision

Replay Decisions renders M01-M05 through an in-page layer tab control. Each layer tab owns that layer's short role explanation, metric cards, charts, summary table, and effective decision ledger. Summary mode can keep cross-model comparison charts; focus mode uses cumulative time-axis line charts over replay month because current layer-review buckets are sparse and raw monthly percentages would overstate precision.

The Replay Decisions layer metric set is expanded beyond Effective, Accept %, Harm %, and Mean Regret in both macro and focus mode. Effective remains the denominator/context. Correct % and Incorrect % own post-replay correctness labels. Accept % is treated as an acceptability rate, not accuracy. Harm % remains the primary harmful-error rate. Missed %, Mean Impact, and worst-regret context are displayed alongside Mean Regret so tails and missed-good decisions are visible.

The page formerly named Models is now Model Groups. The page formerly named Events is now Replay Attribution. Replay Attribution consumes replay-review attribution from `model_group_replay_review_summary`; it focuses on replay process errors, cause families, failure types, miss-attribution layers, first-gap components, and whether review rows publish event candidate references. It must not claim event causality unless event refs are actually published on replay review rows.

### Consequences

- D032's Events-as-temporal-explorer route is superseded for the public navigation surface.
- The `temporal_explorer_summary` contract may remain available as an internal/source read model, but it is not the current public Events page contract.
- Replay Decisions table columns must wrap within fixed-width tracks so long decision, cause, or evidence text does not overflow the page.
- Future replay-review producers should add event refs to failed replay rows before the dashboard can draw event-linked attribution timelines.

## D036 - Replay Operations mirrors Replay Decisions by component

Date: 2026-06-30
Status: Accepted

### Context

Chentong clarified that Replay Operations should be structurally similar to Replay Decisions, but decomposed by replay/execution component instead of model layer. Replay Decisions owns M01-M05 model-layer correctness. Replay Operations owns whether the replay machinery exposed, routed, computed, and executed those decisions correctly.

### Decision

Replay Operations renders C01-C07 through an in-page component tab control:

- C01 Intake
- C02 Entry
- C03 Lifecycle
- C04 Option Review
- C05 Order Intent
- C06 Execution Gate
- C07 Failure Review

Each component tab owns that component's short role explanation, operation cards, charts, summary table, and focused concrete operation ledger. Summary mode compares the selected component across model groups. Focus mode uses the selected model group's published operation action rows as the primary evidence, with component metrics only as supporting diagnostics.

The current projection is bounded by `model_group_replay_review_summary` evidence. It uses `replay_operations_c01_c07` component summaries and concrete action rows produced from `operation_component_action_rows.csv`; `operation_component_flow.csv`, `operation_component_review_packet.csv`, and `operation_component_metrics.csv` provide summary and supporting metric context. The page should distinguish true zeros and explicit lifecycle evidence gaps from missing fields. `decision_review.first_gap_component_counts` and `decision_review.sample_rows` are attribution evidence only and must not backfill the Operations concrete ledger. It must not fabricate operations that the review artifact has not published.

### Consequences

- Replay Operations no longer shows a mixed legacy operation evidence block as its primary content.

## D037 - Replay review units share an envelope, not one metric method

Status: accepted

Chentong clarified that Replay Decisions and Replay Operations can share selector, tab, chart, table, and evidence-ref mechanics, but model layers and operation components must not be forced into the same analysis method. The common UI shape is an envelope for comparison and inspection; the metric family, label role, and evidence requirement must match the unit being reviewed.

Replay Decisions publishes M01-M05 rows with layer-specific methods:

- M01 reviews point-in-time background/context state diagnostics against accepted usability thresholds. It publishes diagnostic correct/incorrect and acceptability metrics without using future returns as decision-time input.
- M02 reviews same-timestamp target selection, rank, direction, and tradability.
- M03 reviews event pressure and risk-state diagnostics available at decision time against accepted downweight/block thresholds. It publishes diagnostic correct/incorrect and acceptability metrics without using future returns as decision-time input.
- M04 reviews underlying action quality with post-replay directional labels.
- M05 reviews option-expression quality, selected contract path, and fill/return consistency.

Replay Operations publishes C01-C07 rows with component-specific methods:

- C01 reviews source, candidate, context, and sector/intake readiness.
- C02 reviews entry gate, candidate rank, signal, and action-surface quality.
- C03 reviews portfolio lifecycle continuity, held-position state, and replacement policy.
- C04 reviews option-expression funnel materialization and selected contract path.
- C05 reviews sizing, capacity, and order-intent contract evidence.
- C06 reviews execution gate, selected-path fill, and materialization coverage.
- C07 reviews operational failure, residual gap, and settlement evidence. C07 is not M06.

Consequences:

- `analysis_method`, `metric_family`, `evidence_role`, and `label_role` are part of the replay review contract, not dashboard-only text.
- C03 must either publish lifecycle/replacement evidence or a lifecycle evidence gap; it must not be hidden as a non-applicable replay mode.

## D038 - Standard replay diagnostics are first-class page-specific review evidence

Status: accepted

Chentong asked that the diagnostic paths used to compare AAPL 2016-2024 model groups become part of regular review instead of remaining one-off manual checks. Codex CLI agreed that the checks should be projected by `model_group_replay_review_summary` and then split by page responsibility rather than added as a generic all-purpose table.

`model_group_replay_review_summary` now publishes standard replay diagnostics from completed post-replay artifacts:

- candidate-entry funnel diagnostics from scored candidates, selected rows, rank quality, and option-expression unexecutable reasons;
- M05 option-expression mechanics, hard-filter overlap, DTE sensitivity, filled-good/bad counts, and net-return contribution;
- mechanism-contract diagnostics from operation contract packets;
- cross-model duplicate trace diagnostics over normalized concrete operation rows.

Page ownership:

- Model Groups uses only model-integrity signals: review completeness, M05 expression-state coverage, mechanism-contract breaches, and duplicate-trace independence risk. It does not turn those diagnostics into trading-performance claims.
- Replay Performance uses the same diagnostics as economic context: entry funnel conversion, option unexecutability, M05 filled-good/bad distribution, M05 net return, and mechanism breaches alongside NAV/return/drawdown.
- Replay Decisions uses the diagnostics only where the model layer makes them relevant: entry funnel and pre-option quality for M02/M04, M05 expression mechanics for M05, and mechanism contracts as supporting context.
- Replay Operations uses concrete operation rows as primary evidence and adds component-relevant context: operation status/block-reason counts, candidate funnel for C01/C02, option materialization for C04-C06, and mechanism contracts for C01-C07.

Consequences:

- These diagnostics must be generated during replay review and consumed from read-model projections, not recomputed from raw artifact paths in the dashboard.
- Future returns, best-available labels, realized returns, and regret remain post-replay labels and must not be described as decision-time inputs.
- A standard diagnostic may appear on multiple pages only with a page-specific interpretation; it must not become a universal mixed-method review table.
- Component rows with no published review evidence show missing/empty states rather than invented counts; published zeros remain visible as zeros.
- Future storage/review producers may add time-indexed C01-C07 component ledgers if the dashboard is expected to show operation timelines for every component.

## D039 - Replay review isolates upstream defects at the decision-time boundary

Status: accepted

Chentong clarified that replay review must not let upstream errors snowball into downstream blame. Each reviewed layer or operation component must be judged only against the state, candidates, and evidence visible at the original replay decision time.

Replay Decisions and Replay Operations now expose review-boundary and responsibility fields in their focused ledgers:

- `review_boundary_ref` and `review_boundary_status` show the point-in-time boundary or output being judged.
- `downstream_review_input_policy` states that the row is judged only against the received decision-time inputs.
- `upstream_error_isolation_scope` states that upstream defects belong to the earliest layer or boundary where they became knowable.
- `responsibility_assignment_policy` distinguishes local layer/component correctness from upstream or handoff defects.

Consequences:

- Post-replay returns, best-available choices, realized returns, and regret remain labels for review, not decision-time inputs.
- Downstream components are not marked wrong merely because an upstream model or handoff delivered a bad candidate set.
- Interface/handoff failures remain explicit boundary failures rather than being hidden inside pure upstream or downstream blame.
