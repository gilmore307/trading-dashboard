# Project Map

## Core files
- `index.html` — main front-end UI, layout, charts, state management, and interactions
- `server.py` — local HTTP server and payload adapters for dashboard endpoints
- `vendor/lightweight-charts.standalone.production.js` — charting library bundle
- `run_daemon.sh` — local helper for running the server/daemon flow

## Docs
- `docs/PROJECT_STATUS.md` — current status and active refactor notes
- `docs/PROJECT_MAP.md` — this file
- `docs/DASHBOARD_DESIGN.md` — layout and table/chart interaction rules
- `docs/DATA_CONTRACTS.md` — important endpoint and payload notes
- `docs/WORKSTREAM_DECISIONS.md` — durable module/product decisions

## Main UI module structure
- `welcome-home`
- `historical-backtest-home`
- `current-trading-overview` → Trading Performance
- `trading-strategy-families` → Strategy Variants
- `trading-composite-routing` → Composite / Routing
- `trading-trade-ledger` → Trade Ledger
- `market-overview` → Market State Analysis overview
- `market-state-separation`
- `market-state-transitions`
- `market-state-explanation`

## Data source direction

The dashboard reads visualization inputs from trading-system artifacts produced outside this repo.
This repo should stay dashboard-only.

Current important payload families:
- family backtest summary
- family equity curves
- family trade ledger
- composite backtest summary
- cluster overview
- family variant dashboard payloads
- dictionary payload
- historical backtest catalog payload

### Control-page specific payloads
- instruments catalog
- historical backtest catalog
- family variant catalog

### Trading Performance specific payloads
- family backtest summary
- family equity curves
- family trade ledger
- composite backtest summary
- selected family variant dashboard payloads

### Market State Analysis specific payloads
- cluster overview
- dictionary
- later: state explanation series payload(s)

## Key current caches / stateful front-end layers
- selected instrument
- selected strategies
- family variant dashboard cache keyed by instrument + family
- state sample instrument for State Explanation
- workspace variant selection/sort state
- composite selector / switch filter state

## Structural rule
This project should keep UI meta-work in `docs/` continuously during active development.
