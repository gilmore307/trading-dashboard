# trading-dashboard docs

This docs tree is the canonical home for the `trading-dashboard` repository documentation.

`trading-dashboard` is the website dashboard/UI repository for the trading system.
It owns dashboard structure, page/module behavior, local server/adaptation work, dashboard-facing data contracts, and shared dictionary/display metadata used by the UI.

## Read in workflow order

1. `01-overview-and-current-status.md`
2. `02-project-map.md`
3. `03-dashboard-design.md`
4. `04-data-contracts.md`
5. `05-workstream-decisions.md`

## Core operating model

- trading repos keep their own output/report generation responsibilities
- `trading-dashboard` consumes those outputs for visualization
- `trading-dashboard` owns the website dashboard surface, not upstream trading logic

## Consolidation note

This doc set is intentionally workflow-first.
The goal is to keep the repo readable top-down without scattering dashboard direction across too many thin notes.
