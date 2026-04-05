# 05 Upstream source inventory

This document records the current first-pass reporting inventory across the upstream trading repos.

The purpose is not to lock every field immediately.
The purpose is to decide which repo is the producer of which source artifacts and which repo should stop owning final report assembly.

## Inventory summary

### `trading-data`
Current role:
- upstream data/context producer
- readiness-signal producer
- coverage/partition contract owner

Current reporting-like material:
- diagnostics/audit/report directories are mentioned in storage docs
- context-layer summaries and holdings exports exist as durable outputs
- output-compaction audit notes exist as documentation, not as the canonical downstream report surface

Steady-state interpretation:
- `trading-data` should publish machine-readable data/context outputs, manifests, and readiness signals
- it should not become the long-term home of cross-repo or human-facing final report assembly

### `trading-strategy`
Current role:
- strategy-layer execution/replay producer
- family/global oracle producer
- run-manifest producer

Current reporting-like material:
- family ranking/comparison summaries
- family/global oracle summaries
- run manifests and output metadata

Steady-state interpretation:
- `trading-strategy` should keep producing strategy-layer summaries/manifests as producer outputs
- unified report composition that combines those outputs with other repos should move to `trading-report`

### `trading-model`
Current role:
- offline model/research output producer
- state-evaluation and oracle-gap reporting designer

Current reporting-like material:
- state-stability report concepts
- oracle-gap report concepts
- model composite comparison outputs
- layer-policy comparison outputs

Steady-state interpretation:
- `trading-model` may still define model-side evaluation output schemas
- but the canonical final cross-repo report surface should converge in `trading-report`

### `trading-execution`
Current role:
- runtime data producer
- execution review/export producer
- upgrade-validation report source

Current reporting-like material:
- runtime data contract for downstream consumers
- execution review/export path
- JSON/Markdown review artifacts
- upgrade-oriented review bundle semantics

Steady-state interpretation:
- `trading-execution` should remain the producer of machine-readable runtime/review artifacts
- the final report product that joins runtime review with other upstream domains should move to `trading-report`

### `trading-manager`
Current role:
- orchestration/control-plane producer
- workflow/task/run-state producer

Current reporting-like material:
- workflow/run manifests
- retention/archive state
- system-wide operational metadata

Steady-state interpretation:
- `trading-manager` should expose orchestration metadata and run manifests
- it should not become the long-term home of the unified report presentation layer

## Reporting migration principle

Use the following rule everywhere:
- producer outputs stay with the producing repo
- final cross-repo report assembly moves to `trading-report`

## First migration target

The most concrete first migration candidate is currently `trading-execution` because:
- it already has explicit review/export semantics
- it already has documented downstream consumer contracts
- it already produces report-like artifacts with clear operational meaning

That said, the migration should still preserve the repo boundary:
- execution artifacts remain produced by `trading-execution`
- unified reporting on top of those artifacts moves to `trading-report`
