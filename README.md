# trading-report

Unified report aggregation repository for the trading system.

Repository chain:
- `trading-data` -> canonical upstream market/context outputs
- `trading-strategy` -> strategy-layer replay/oracle outputs
- `trading-model` -> offline model/ranking/policy outputs
- `trading-execution` -> runtime/live execution outputs
- `trading-manager` -> orchestration/run manifests across the stack
- `trading-report` -> cross-repo report assembly, dashboard-facing data layers, and visualization surface

## What this repository does

`trading-report` is the single downstream reporting-and-visualization repo.
It is responsible for:
- collecting machine-readable output/manifests from upstream trading repos
- normalizing them into one shared reporting contract
- assembling cross-repo report bundles
- generating dashboard-ready detail/overview datasets
- preserving report lineage so consumers know which upstream artifacts were used
- hosting the visualization surface and lightweight serving/adaptation layer for those reporting outputs

## What this repository does not do

`trading-report` should not own:
- raw market-data acquisition
- strategy replay computation
- model-training or ranking internals
- live execution internals
- cross-repo scheduling/timing policy

In other words:
- upstream repos produce outputs
- `trading-manager` decides when workflows run
- `trading-report` turns upstream outputs into unified detail/overview/report layers
- `trading-report` also hosts the visualization surface for those layers

## Core architecture rule

All trading-system report generation should converge here.
The other repos should stop owning repo-local final report assembly as the reporting contract stabilizes.

Preferred boundary:
- upstream repos emit durable machine-readable outputs/manifests
- `trading-report` ingests those outputs and composes report artifacts
- downstream dashboard/UI layers read from `trading-report` outputs rather than scraping multiple repos directly

## Initial upstream sources

The first migration scope covers outputs from:
- `trading-manager`
- `trading-execution`
- `trading-model`
- `trading-strategy`
- `trading-data`

## Initial report responsibilities

First-phase report work should define:
- upstream artifact intake contract
- normalized report schema
- report bundle directory layout
- source-lineage / provenance metadata
- cross-repo summary assembly rules
- dashboard-facing export contract

## Documentation

Start with:
- `docs/README.md`
- `docs/01-overview.md`
- `docs/02-upstream-boundaries-and-intake.md`
- `docs/03-report-schema-and-bundle-layout.md`
- `docs/04-dashboard-handoff-contract.md`
- `docs/05-upstream-source-inventory.md`
- `docs/06-intake-contract.md`
- `docs/07-report-taxonomy.md`
- `docs/08-report-id-window-and-provenance.md`
- `docs/09-repo-by-repo-migration-plan.md`
- `docs/10-open-questions-and-next-doc-work.md`
- `docs/11-ops-dashboard-merge-rationale.md`
- `docs/12-merged-repo-scope.md`
- `docs/13-dashboard-first-design-for-trading-data.md`
- `TODO.md`

## Current phase

Docs-first repository bootstrap.
The first phase is to define the reporting boundary clearly before moving report/export code out of the upstream repos.
