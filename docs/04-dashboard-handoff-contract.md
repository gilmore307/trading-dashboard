# 04 Dashboard handoff contract

## Role

`trading-report` is the producer for downstream visualization surfaces.
`ops-dashboard` and any future UI should consume report outputs from here rather than reading multiple upstream repos directly.

## Contract direction

Dashboard-facing data exported by `trading-report` should be:
- normalized
- versioned
- provenance-aware
- independent of upstream repo-internal folder quirks where possible

## Preferred handoff style

The dashboard should receive:
- stable JSON payloads
- stable report bundle paths
- summary metadata for listing/index pages
- source/provenance metadata for drill-down and auditability

## Anti-pattern to avoid

Avoid making the dashboard reconstruct a whole report by manually stitching together:
- `trading-data` files
- `trading-strategy` files
- `trading-model` files
- `trading-execution` files
- `trading-manager` state

That stitching belongs here, not in the dashboard.

## First implementation target

The initial milestone is not a perfect universal schema.
It is a stable enough shared contract that:
1. upstream repos can stop formatting their own final reports independently
2. dashboard work can proceed against one report source instead of five different output styles
