# 01 Overview

`trading-report` is the unified downstream report-assembly repository for the trading stack.

Its job is to sit after the producing repos and before the visualization surface.

Canonical flow:
- `trading-data` produces upstream market/context artifacts
- `trading-strategy` produces strategy replay/oracle artifacts
- `trading-model` produces offline model/evaluation outputs
- `trading-execution` produces runtime/execution/review outputs
- `trading-manager` produces orchestration/run manifests
- `trading-report` consumes those outputs and assembles unified reports
- `ops-dashboard` consumes unified report outputs for visualization

The architectural goal is to stop letting each upstream repo invent its own final report surface.
That local-report pattern creates duplication, formatting drift, and schema inconsistency.

`trading-report` should become the canonical place for:
- report schema ownership
- cross-repo summary assembly
- provenance tracking
- bundle-level export for downstream dashboards
