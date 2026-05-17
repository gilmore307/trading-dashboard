# Architecture

## Module Map

| Docs band | Implementation surface | Purpose |
|---|---|---|
| `10_*` | repo-level acceptance surfaces | Dashboard acceptance and closeout evidence. |
| `20_*` | `web/`, `src/` UI/data-shape code | Owner-facing information architecture. |
| `30_*` | `src/trading_dashboard/`, `scripts/read_models/` | Storage-backed dashboard read-model adapters. |

## Purpose

This file defines the intended component workflow for `trading-dashboard`.

## Primary Flow

```text
read accepted summary/read-model outputs -> adapt for owner-facing presentation -> render chart-first dashboard view -> provide contextual field profiles and issue-focused drilldowns
```

## Operating Principles

- Dashboard consumes existing outputs; it does not recompute upstream truth.
- Dashboard actions must not mutate strategy/model/execution state unless a future explicit contract allows it.
- Visualization should preserve enough provenance to explain visible statuses, but raw manifests/artifacts/ready signals stay hidden by default.
- Pages should answer owner-facing questions before exposing implementation details.
- Registry profiles explain visible fields contextually; the dashboard is not a primary registry browser.
- Shared fields, statuses, type values, helpers, and reusable templates must come from `trading-manager`.
- Runtime outputs must be written outside Git-tracked source paths.
- Cross-repository handoffs should use accepted request, artifact, manifest, and ready-signal contracts.

## Collaboration Boundary

`trading-dashboard` collaborates with other trading repositories through explicit contracts, not direct mutation of their local state.

Upstream inputs and downstream outputs should be described by artifact references, manifests, ready signals, requests, or accepted storage contracts.

## Not Current Historical-Training Scope

Dashboard runtime/UI implementation remains outside the no-broker historical-training run. The first accepted implementation slice is limited to read-only adapters over storage-hosted dashboard read-model `latest.json` files; it does not create UI pages, provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes.
