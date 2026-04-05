# 11 Ops-dashboard merge rationale

This document records the rationale for merging `ops-dashboard` into `trading-report` at the repository level.

## Decision summary

`trading-report` should no longer be treated as only a report-assembly repository.
It should become the unified repo for:
- report assembly
- dashboard-facing data contracts
- visualization surface
- lightweight serving/adaptation layer
- shared reporting/dictionary metadata used by the visualization layer

In short:
- `trading-report` becomes the new home for what `ops-dashboard` was trying to do
- `ops-dashboard` becomes a legacy repo scheduled for retirement after migration

## Why merge

## 1. The boundaries now overlap too much

`trading-report` was created to prepare unified outputs for downstream visualization.
Once that is true, the visualization-facing data contracts, payload shaping, and dashboard shell are no longer a separate product boundary.

Keeping them in two repos would create repeated questions such as:
- where does the canonical dashboard-facing schema live?
- where do overview/detail table designs live?
- where should matrix/detail interaction behavior be documented?
- where should shared metric/dictionary metadata live?

Those are all the same workstream now.

## 2. `ops-dashboard` is currently more of a delivery shell than a separate domain

The current `ops-dashboard` repo contains:
- a static dashboard shell
- a local serving layer
- data contracts
- metric dictionary assets
- dashboard docs

That is important implementation work, but it is not a separate business domain from unified reporting.
It is the presentation layer of the same reporting product.

## 3. The new design direction is dashboard-first

The report is no longer being designed as prose-only output.
It is being designed backward from future interactive visualization:
- overview matrix
- detail table
- row/column/cell driven filtering
- dashboard-ready payloads

That means the report schema and the dashboard interaction model should live in one repo.

## 4. This reduces future migration churn

If `trading-report` and `ops-dashboard` stay split, future work would need repeated cross-repo synchronization for:
- report schema changes
- dashboard payload changes
- dictionary/label changes
- server/data-adapter changes
- page/module interaction changes

Merging them reduces unnecessary repo-boundary overhead.

## What should move from `ops-dashboard`

The following areas should migrate into `trading-report` over time:
- dashboard UI shell
- local server / adapter layer
- dashboard data contracts
- metric dictionary assets and related docs
- dashboard project docs/TODO where still relevant

## What should remain true after merge

Even after merge, keep the internal architectural boundary clear:
- producer repos emit outputs/manifests/signals
- `trading-report` assembles normalized reporting/detail layers
- `trading-report` also hosts the visualization/presentation surface that consumes those normalized layers

## Non-goal

This merge decision does **not** mean every producer repo should start embedding UI logic.
The UI stays centralized.
Only the repo boundary changes.
