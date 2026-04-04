# 02 Upstream boundaries and intake

## Boundary rule

Upstream trading repos should end their responsibility at durable output production.
They should not remain the long-term home of final human-facing report assembly once the unified reporting path is active.

Preferred split:
- upstream repos own domain outputs and manifests
- `trading-report` owns report normalization and final report bundle assembly

## First-wave upstream repos

### `trading-data`
Expected contribution:
- market/context data refresh outputs
- readiness signals
- coverage manifests
- data-scope metadata needed for reporting completeness

### `trading-strategy`
Expected contribution:
- strategy replay manifests
- family/variant summary outputs
- oracle/composite summary artifacts
- output path metadata and run manifests

### `trading-model`
Expected contribution:
- market-state/model evaluation outputs
- ranking/scoring outputs
- selection/promotion candidate summaries
- model-side run manifests

### `trading-execution`
Expected contribution:
- runtime/execution cycle outputs
- review/export inputs
- operational summary artifacts
- promotion/handover review metadata

### `trading-manager`
Expected contribution:
- workflow-level run manifests
- task sequencing/state outputs
- cross-repo completion context
- orchestration metadata tying the upstream runs together

## Intake principle

`trading-report` should ingest stable, machine-readable upstream outputs.
It should not depend on brittle scraping of ad-hoc markdown text when a structured payload can exist instead.

Where a repo currently writes local markdown/json reports directly, the migration target should be:
1. preserve or improve the machine-readable producer output
2. move the final report composition logic into `trading-report`
3. keep provenance linking back to the exact upstream artifact paths/versions
