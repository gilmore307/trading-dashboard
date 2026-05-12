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
- Shared names and contracts must route through `trading-main`.
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
- Shared names and contracts must route through `trading-main`.
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
- Shared names and contracts must route through `trading-main`.
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
