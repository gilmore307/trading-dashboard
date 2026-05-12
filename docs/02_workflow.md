# Workflow

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

Dashboard implementation is intentionally outside the no-broker historical-training run. The exact first implementation slice, request/read-model shape, artifact/manifest/ready-signal schema interactions, shared storage references, test harness, fixture policy, and package layout should be accepted only after stable training evidence exists to display.
