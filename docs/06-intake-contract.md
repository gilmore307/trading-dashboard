# 06 Intake contract

This document defines the first unified intake contract for `trading-report`.

## Core rule

`trading-report` should ingest durable machine-readable producer outputs.
It should not rely on brittle ad-hoc human-readable formatting as its primary source whenever a structured producer artifact can exist.

## Intake object classes

Every upstream intake object should be classifiable as one of these:
- `artifact`
- `manifest`
- `signal`
- `summary`
- `event`

## Minimum intake metadata

Every ingested source object should be describable with at least:
- `source_repo`
- `source_domain`
- `artifact_type`
- `artifact_path`
- `window`
- `symbol_scope` when relevant
- `generated_at` when available
- `version` or schema marker when available
- `producer_run_id` / `manifest_id` when available

## Repo-by-repo first-wave intake

### `trading-data`
Ingest classes:
- data refresh completion signals
- coverage manifests
- context output references
- dataset partition metadata

Primary role in reporting:
- describe upstream data completeness, freshness, and context coverage

### `trading-strategy`
Ingest classes:
- run manifests
- variant/family summary outputs
- family oracle summaries
- global oracle summaries

Primary role in reporting:
- describe strategy-run scope, comparison surfaces, and output provenance

### `trading-model`
Ingest classes:
- model evaluation summaries
- oracle-gap summaries
- state-evaluation summaries
- mapping/version metadata

Primary role in reporting:
- describe how the model performed relative to baselines/oracle and which mappings/versions were active

### `trading-execution`
Ingest classes:
- runtime execution history references
- latest-state execution artifact references
- upgrade request/result/handover artifacts
- review/export summaries

Primary role in reporting:
- describe live/runtime behavior, execution fidelity, upgrade boundaries, and operational outcomes

### `trading-manager`
Ingest classes:
- workflow manifests
- task/run status summaries
- orchestration metadata
- retention/archive state summaries when needed

Primary role in reporting:
- tie the upstream runs together into one cross-repo workflow/report window

## Intake anti-patterns

Avoid these as primary intake sources:
- copying prose-only markdown and trying to parse it as structured data
- depending on private in-memory objects from upstream repos
- depending on temporary debug-only files with no durable contract
- treating old repo-local final report markdown as the canonical long-term machine interface

## Intake normalization rule

`trading-report` may normalize upstream differences internally, but should preserve provenance so downstream consumers can always trace back to the producer artifact family.
