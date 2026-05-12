# Decision


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

Close the current presentation-boundary phase. `docs/07_dashboard_closeout.md` is the authoritative closeout receipt.

No active dashboard-preparation tasks remain. Future dashboard work is deferred until a concrete reviewed output surface exists: first UI implementation slice, package/source/test layout, fixture policy, read models over manager/storage outputs, and storage/reference requirements.

### Consequences

- `trading-dashboard` remains a read-only presentation consumer unless a future mutation contract is explicitly accepted.
- This closeout does not enable dashboard runtime, provider calls, manager dispatch, model activation, broker execution, or account mutation.
- New dashboard implementation must start from reviewed manager/storage output refs and preserve provenance.


## D005 - Dashboard is an owner-facing summary, not an internal maintenance console

Date: 2026-05-12
Status: Accepted

### Context

Chentong clarified that the website exists to summarize system, model, signal, and trading-performance questions for him. System-maintenance details and model intermediate products are mostly internal machinery and should not become normal website content.

### Decision

The dashboard primary navigation will focus on owner-facing summary and explanation pages:

1. Current Status
2. Alerts and Exceptions
3. Tasks, with Historical Modeling and Realtime Trading subtabs
4. Models, with one subtab for each of the eight model layers
5. Realtime Trading Signals
6. Trading Performance Summary
7. Registry Dictionary

The dashboard should be simple, clear, chart-first, and text-light. Internal artifacts, manifests, ready-signal rows, request payloads, daemon internals, raw logs, and model intermediate products are hidden by default. They may appear only in advanced diagnostic drilldowns when needed to explain a visible owner-facing issue.

Registry-backed field profiles remain useful as contextual hover/detail explanations for fields already shown on the dashboard. A read-only Registry Dictionary is also accepted because it helps interpret system vocabulary, but it must stay explanatory and must not become a registry editor or maintenance console. Alerts and exceptions are accepted because they give Chentong an owner-actionable queue of problems to inspect and resolve.

### Consequences

- `docs/08_information_architecture.md` owns the initial page structure and visibility rules.
- Implementation must not turn `trading-dashboard` into a general artifact browser, registry editor, maintenance console, or workflow controller. The Registry Dictionary is read-only explanation, and Alerts/Exceptions are owner-facing issue summaries.
- First implementation slice should consume owner-facing summary/read-model outputs, not raw internal control-plane tables as primary UI content.
- Advanced diagnostics must stay issue-focused and secondary.


## D006 - Dashboard consumes owner-facing read models, not raw internals

Date: 2026-05-12
Status: Accepted

### Context

The dashboard could accidentally become a complex internal-table UI if it reads directly from manager requests, run manifests, artifact refs, ready-signal rows, raw receipts, daemon internals, execution adapter records, storage lifecycle internals, or raw registry SQL history. Chentong wants a summary surface that explains system/model/trading posture and highlights actionable problems, not an internal maintenance console.

### Decision

Dashboard pages must consume owner-facing summary/read-model contracts materialized in `trading-storage`. `docs/09_dashboard_read_models.md` owns the dashboard-side initial contract set, and `trading-storage/docs/96_dashboard_read_models.md` owns the storage-home boundary:

- `current_system_status_summary_v1`;
- `alert_exception_summary_v1`;
- `historical_task_progress_summary_v1`;
- `realtime_task_progress_summary_v1`;
- `model_layer_readiness_summary_v1`;
- `model_promotion_posture_summary_v1`;
- `registry_dictionary_profile_v1`.

Future realtime/performance/storage lifecycle summaries are parked until mature evidence exists.

Advanced diagnostics may only be entered from a visible owner-facing issue such as an alert, blocked task, model blocker, degraded signal, performance anomaly, or stale dashboard data warning. There must not be a global artifact browser, receipt browser, log viewer, control-plane table browser, raw registry-row browser, or daemon internals explorer as a primary surface.

### Consequences

- First implementation should build against storage-hosted summary/read-model outputs, not raw control-plane tables.
- Raw evidence remains available only as issue-focused diagnostic support.
- Storage lifecycle appears through Current Status and Alerts unless it becomes a daily owner-facing concern.
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
- `trading-storage` defines the initial physical layout and validation boundary in `trading-storage/docs/97_dashboard_summary_layout.md`.
- Shared summary contract names are routed through `trading-manager` registry migration `344_register_dashboard_read_model_contracts.sql` before cross-repository implementation depends on them.
- The first implementation slice should request/consume storage-hosted summaries rather than raw component internals.


## D008 - First dashboard implementation is a storage read adapter

Date: 2026-05-12
Status: Accepted

### Context

`historical_task_progress_summary_v1` now has a manager-owned semantic producer and a storage-owned refresh/materialization wrapper. The dashboard needs a first implementation slice that can consume this accepted summary without becoming a runtime UI, workflow controller, raw artifact browser, or storage writer.

### Decision

The first dashboard implementation slice is a read-only adapter over storage-hosted dashboard read-model `latest.json` files:

- importable module: `src/trading_dashboard/read_models.py`;
- executable helper: `scripts/read_models/read_latest_dashboard_read_model.py`;
- first consumed contract: `historical_task_progress_summary_v1`.

The adapter reads only accepted `storage/dashboard/read_models/<contract_type>/latest.json` summaries, validates the common dashboard envelope shape, and projects the payload into a UI-ready dictionary. It does not query raw manager/model/data/execution/storage internals and does not perform provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes.

### Consequences

- Future UI/runtime pages should consume this adapter boundary or a successor with the same storage-hosted read-model discipline.
- Missing `latest.json` is surfaced as a read-adapter error rather than silently fabricating dashboard values.
- Additional dashboard contracts can reuse the adapter after their semantic producer and storage materialization path are accepted.

## D009 - First website slice is a read-only Historical Modeling page

Date: 2026-05-12
Status: Accepted

### Context

The read-model pipeline is now concrete enough to stop discussing the dashboard abstractly. Chentong asked for a first visible product that follows the accepted outline and can be reviewed for practical UI feedback.

### Decision

The first website/runtime slice uses Vite + React + TypeScript and implements one read-only page: Tasks / Historical Modeling / Historical Task Progress.

The page consumes `historical_task_progress_summary_v1` through the dashboard read-model boundary and the local Vite development API, which reads `trading-storage/storage/dashboard/read_models/<contract_type>/latest.json`. The page displays status, freshness, current month, active stage, provider/lock posture, progress, stage counts, optional stage coverage, next expected system action, blocker category, and diagnostic refs. It includes public read-only interactivity: clickable navigation, quick view switches, refresh, diagnostics expansion, and a JSON API link.

### Consequences

- This is a visible website slice, not a workflow-control surface.
- No dashboard-originated provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes are allowed.
- Other primary tabs may appear in navigation as accepted/parked states, but they should not fabricate missing summaries.
- Future pages should reuse storage-hosted dashboard read models and avoid raw internal tables as primary UI input.
