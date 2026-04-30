# Workflow

## Purpose

This file defines the intended component workflow for `trading-dashboard`.

## Primary Flow

```text
read artifacts/manifests/signals -> adapt for presentation -> render dashboard view -> surface links/evidence
```

## Operating Principles

- Dashboard consumes existing outputs; it does not recompute upstream truth.
- Dashboard actions must not mutate strategy/model/execution state unless a future explicit contract allows it.
- Visualization should preserve provenance links to manifests and artifacts.
- Shared fields, statuses, type values, helpers, and reusable templates must come from `trading-manager`.
- Runtime outputs must be written outside Git-tracked source paths.
- Cross-repository handoffs should use accepted request, artifact, manifest, and ready-signal contracts.

## Collaboration Boundary

`trading-dashboard` collaborates with other trading repositories through explicit contracts, not direct mutation of their local state.

Upstream inputs and downstream outputs should be described by artifact references, manifests, ready signals, requests, or accepted storage contracts.

## Open Gaps

- Exact first implementation slice.
- Exact request shape consumed or produced by this repository.
- Exact artifact, manifest, and ready-signal schema interactions.
- Exact shared storage paths and references.
- Exact test harness and fixture policy.
- Exact package/source layout once implementation begins.
