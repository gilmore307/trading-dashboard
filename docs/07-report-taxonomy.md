# 07 Report taxonomy

This document defines the first-pass report taxonomy for the unified reporting layer.

## Goal

Not every report should be one giant mixed bundle.
The reporting repo should support a small clear family of report types with shared schema rules.

## First-pass report families

### 1. Workflow report
Purpose:
- summarize one end-to-end orchestrated workflow window across the stack

Likely sources:
- `trading-manager`
- `trading-data`
- `trading-strategy`
- `trading-model`
- `trading-execution`

### 2. Data readiness / coverage report
Purpose:
- summarize whether upstream data/context coverage was complete enough for downstream stages

Likely primary producer:
- `trading-data`

### 3. Strategy run report
Purpose:
- summarize strategy replay/oracle outputs for a given scope/window

Likely primary producer:
- `trading-strategy`

### 4. Model evaluation report
Purpose:
- summarize state-model quality, oracle-gap behavior, and mapping/version context

Likely primary producer:
- `trading-model`

### 5. Runtime execution review report
Purpose:
- summarize live/runtime behavior, upgrade boundaries, and execution fidelity

Likely primary producer:
- `trading-execution`

### 6. Cross-repo dashboard bundle
Purpose:
- provide a dashboard-facing normalized export that can mix selected outputs from multiple report families

Likely producer:
- `trading-report`

## Taxonomy rule

A report family should answer one primary question.
Do not overload every report with all possible sections from all repos by default.

## Shared taxonomy fields

Every report type should still declare:
- `report_type`
- `report_id`
- `report_window`
- `source_repos`
- `status`
- `schema_version`

## Recommended first implementation order

1. runtime execution review report
2. model evaluation report
3. workflow report
4. dashboard bundle composition
