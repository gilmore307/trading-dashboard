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
