# Data Contracts

## Important endpoints

### General / module control
- `/data/instruments/catalog.json`
- `/data/historical-backtest/catalog.json`
- `/data/dictionary.json`

### Trading Performance
- `/data/family-backtest-summary.json`
- `/data/family-equity-curves.jsonl?family=<family>&family=<family>...`
- `/data/family-trade-ledger.jsonl`
- `/data/composite-backtest-summary.json`
- `/data/family-variant-dashboard/<family>.json`
- `/data/family-variant-dashboard/catalog.json`

`/data/family-variant-dashboard/<family>.json` is the stable dashboard-read endpoint.

Server rule:
- if split outputs exist under `<family>/summary.json`, `<family>/composite.json`, and `<family>/variants/*.json`, the server should aggregate from those files directly
- the front end should not require a compatibility monolith in order to load a family dashboard
- compatibility monoliths may still be served if a family has not yet been migrated

## Family variant artifact workflow rule

Family variant dashboard artifacts should no longer be treated as one growing monolithic family blob by default.

Target on-disk structure for each family:
- `data/intermediate/dashboard_payloads/family_variant_dashboard/<family>/summary.json`
- `data/intermediate/dashboard_payloads/family_variant_dashboard/<family>/composite.json`
- `data/intermediate/dashboard_payloads/family_variant_dashboard/<family>/variants/<variant_id>.json`

Workflow rule going forward:
- new or regenerated family-variant artifacts should be emitted in this split directory structure
- compatibility monoliths may exist temporarily during migration, but they are transitional outputs, not the target format
- when artifacts get larger, prefer splitting one level deeper rather than growing a single JSON blob
- dashboard loading should keep the Load button as the loading boundary, but payload organization should stay small-file / scope-bounded underneath that boundary

## Preferred retained-data policy for family variants

The dashboard does not need full heavy artifacts for every tested variant forever.

Preferred retention model:
- keep lightweight summary/evaluation records for all tested variants
- keep full heavy artifacts locally only for the most useful subset, currently:
  - top 1 variant per cluster within each family
- keep reserve/history records for top 10 variants per cluster in summary/history layers
- treat the rest as archived summary/history-only variants

Family layer uses the same idea with smaller counts:
- top 1 family per cluster = active
- top 5 families per cluster = reserve
- the rest = archived

### `summary.json` should retain
- `family`
- `variant_count_total`
- `variant_count_evaluated`
- `variant_count_retained_full`
- `retained_full_variant_ids`
- `reserve_variant_ids`
- `composite_summary`
- `cluster_rankings`
- `variant_summaries`

### Each lightweight `variant_summaries` record should retain
- `variant_id`
- `family`
- `tested`
- `retained_full`
- `active`
- `deprecated`
- `deprecated_reason`
- overall metrics such as:
  - `total_return`
  - `max_drawdown`
  - `trade_count`
  - `win_rate`
- per-cluster metrics such as:
  - `cluster_id`
  - `rank_in_cluster`
  - `avg_utility_1h`
  - `sample_count`
  - `trade_count`
  - `avg_trade_return`
  - `positive_rate`
  - `turnover_count`

### `variants/<variant_id>.json` should exist only for retained full variants
These files may keep the heavy data required for deep inspection:
- `summary`
- `curve`
- `ledger`

### Heavy data that may be dropped for non-retained variants
- full equity curve points
- full trade ledger
- signal-level records
- trade-point / switching-point detail
- other large chart-ready arrays not needed for catalog/ranking decisions

## Market State Analysis
- `/data/cluster-overview.json`
- `/data/state-explanation.json?cluster_id=<id>&instrument=<instrument>&window=<recent|representative>`

## Current front-end expectations

### instruments catalog
Expected fields per instrument row:
- `instrument`
- `label`
- `startTs`
- `endTs`
- `granularity`
- `rowCount`

Current UI meaning:
- `startTs` / `endTs` feed the Start Date / End Date columns in the Historical Backtest instrument-selection table
- `granularity` feeds the time-scale selection-help column
- `rowCount` gives the rough payload/data coverage scale for selection decisions

### historical backtest catalog
Expected top-level fields:
- `instrument`
- `files`
- `families`

File rows currently expose:
- `key`
- `label`
- `path`
- `filename`
- `exists`
- `kind`
- `sizeBytes`
- `lineCount`
- `downloadPath`

Family rows currently expose:
- `instrument`
- `family`
- `variant_count`
- `path`
- `sizeBytes`
- `compositeFinalEquity`
- `compositeMaxDrawdown`
- `compositeCurvePoints`

Current UI use:
- Historical Backtest instrument selection table uses the instruments catalog
- Historical Backtest strategy selection table uses the family rows in the catalog
- Artifact Checklist uses the file rows and download paths
- the final load card uses the current selections plus stage-based load progress

### cluster overview
The dashboard currently expects cluster rows to carry at least:
- `cluster_id`
- `row_count`
- `best_region`
- `best_avg_utility_1h`
- `spread_best_minus_worst`
- `best_family`
- `best_family_avg_utility_1h`
- `best_variant`
- `best_variant_family`
- `best_variant_avg_utility_1h`

## Loading behavior note
- Historical Backtest should be the user-controlled entry point for heavy Trading Performance loads.
- the front end now supports family-selection-constrained loads for Trading Performance.
- the current implementation has first-pass family dashboard reuse behavior for still-selected families, while deselected families are cleared from cache.
- instrument changes should be treated as a stronger boundary than family selection changes.

## Design note
- Trading Performance is instrument-scoped.
- Market State Analysis is generally anonymized/state-centric, except State Explanation which is allowed to use a controlled sample instrument as a real-market projection layer.
