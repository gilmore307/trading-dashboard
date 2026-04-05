# 09 Repo-by-repo migration plan

This document defines the documentation-only migration plan for moving final report assembly into `trading-report`.

## Migration rule

Do not move everything at once.
First make the boundaries explicit, then migrate one report family at a time.

## `trading-execution`
Current state:
- strongest existing review/export contract
- explicit downstream consumer language already exists
- existing report/export vocabulary is already close to the future unified model

Migration target:
- preserve runtime/review artifact production in `trading-execution`
- move canonical final execution-review assembly into `trading-report`

Documentation actions:
- keep runtime data contract as the producer-side source of truth
- clarify that downstream final report assembly lives in `trading-report`

## `trading-model`
Current state:
- has substantial reporting design already
- model-side reports are conceptually rich but still repo-local today

Migration target:
- preserve model-evaluation output definitions in `trading-model`
- move canonical final cross-repo report assembly into `trading-report`

Documentation actions:
- distinguish model-side evaluation outputs from unified downstream reports
- keep model docs focused on producer-side evaluation semantics

## `trading-strategy`
Current state:
- already defines output/handoff contracts and summaries
- report-like material is mostly strategy-local summary/manifests

Migration target:
- preserve run manifests and strategy-layer summaries in `trading-strategy`
- move final multi-repo report composition into `trading-report`

## `trading-data`
Current state:
- mostly output/contract/coverage language rather than formal final reports
- diagnostics/audits exist but should not become the unified downstream report center

Migration target:
- preserve data/context outputs, readiness signals, and coverage manifests in `trading-data`
- route cross-repo downstream reporting to `trading-report`

## `trading-manager`
Current state:
- owns workflow/control-plane view
- can provide workflow manifests and orchestration state for unified reporting

Migration target:
- preserve run/task/workflow manifests in `trading-manager`
- avoid turning `trading-manager` into the report presentation repo

## Migration sequence recommendation

1. execution-review report family
2. model-evaluation report family
3. workflow report family
4. dashboard-facing cross-repo bundle
