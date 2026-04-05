# 13 Dashboard-first design for trading-data

This document records the dashboard-first design direction for the `trading-data` reporting surface inside the merged `trading-report` repo.

## Core decision

For `trading-data`, do not split the visualization target into many separate reports.
Use one canonical report family built for interactive visualization.

Recommended family name:
- `data_coverage_report`

## Core UI structure

### Overview matrix (main table)
- rows = `symbol`
- columns = `dataset`
- cell value = status summary

Example dataset columns:
- `bars_1min`
- `quotes`
- `trades`
- `options_snapshots`
- `news`
- `etf_holdings_context`
- `constituent_etf_context`

Recommended display statuses:
- `ready`
- `partial`
- `stale`
- `missing`
- `n/a`

## Detail table (secondary table)

The detail table is the canonical truth layer.
Each row represents one `symbol + dataset` detail record.

Recommended fields:
- `symbol`
- `dataset`
- `status`
- `earliest_month`
- `latest_month`
- `earliest_ts`
- `latest_ts`
- `month_count`
- `partition_count`
- `last_refresh_at`
- `ready_flag`
- `stale_flag`
- optional gap/notes fields later

## Interaction model

The overview matrix is a filterable interaction surface for the detail table.

Rules:
- clicking a row filters the detail table by `symbol`
- clicking a column filters the detail table by `dataset`
- clicking a cell filters the detail table by `symbol + dataset + status`

## Layer rule

- detail table = canonical detail layer
- overview matrix = derived overview layer

All future charts/cards should be derivable from the same detail layer when possible.

## Why this design

This structure optimizes for the real user questions:
- what symbols exist now?
- what datasets exist for each symbol?
- what is missing?
- how far does coverage extend?
- which data is stale?

These questions are better served by:
- one overview matrix
- one detail table
than by many disconnected report families.
