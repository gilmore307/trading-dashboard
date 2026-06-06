# Architecture

## Module Map

| Docs band | Implementation surface | Purpose |
|---|---|---|
| `10_*` | repo-level acceptance surfaces | Dashboard acceptance and acceptance evidence. |
| `20_*` | `web/`, `src/` UI/data-shape code | Owner-facing information architecture. |
| `30_*` | `src/trading_dashboard/`, `scripts/read_models/` | Storage-backed dashboard read-model adapters. |

## Purpose

This file defines the intended component workflow for `trading-dashboard`.

## Primary Flow

```text
storage/06_dashboard_cache/read_models/<contract_type>.json -> /api/read-models/<contract_type>/latest and /ws/read-models/<contract_type>/latest -> read-only dashboard views
```

The read-only Data page uses `/api/data/tables` and `/api/data/query` for explicitly allowlisted source, feature, and main model-output tables.

## Operating Principles

- Dashboard consumes existing outputs; it does not recompute upstream truth.
- Dashboard actions must not mutate strategy/model/execution state unless a future explicit contract allows it.
- Visualization should preserve enough provenance to explain visible statuses, but raw manifests/artifacts/ready signals stay hidden by default.
- Pages should answer owner-facing questions before exposing implementation details.
- Registry profiles explain visible fields contextually; the dashboard is not a primary registry browser.
- Shared fields, statuses, type values, helpers, and reusable templates must come from `trading-manager`.
- Runtime outputs must be written outside Git-tracked source paths.
- Cross-repository handoffs use accepted storage-hosted read-model contracts for primary dashboard pages.

## Collaboration Boundary

`trading-dashboard` collaborates with other trading repositories through explicit contracts, not direct mutation of their local state.

Primary upstream inputs are accepted storage-hosted dashboard read models. The dashboard may surface sanitized provenance or issue references only to explain visible owner-facing statuses.
