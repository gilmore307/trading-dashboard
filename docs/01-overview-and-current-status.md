# Project Status

_Last updated: 2026-04-05_

## Goal

Build a website dashboard/workspace for the trading system that is split into clear modules:
- **Welcome** as the top-level entry
- **Historical Backtest** as the module entry/control center
- **Trading Performance** as the trading-and-return layer
- **Market State Analysis** as the state/cluster interpretation layer
- later parameter-focused sections kept separate from both

## Current repo direction

`trading-dashboard` is dashboard-only.
Trading repos keep their own output/report generation responsibilities.
This repo focuses on UI/server/data-contract/dictionary work only.

The current implementation baseline comes from the old `ops-dashboard` code/content.

## Current state

The dashboard is in an active restructuring phase.

Recent major direction changes:
- the repo was reset from the abandoned `trading-report` idea back to a dashboard-only direction
- the site no longer treats Trading Performance as the top-level landing page
- a Welcome page and a Historical Backtest module homepage were introduced
- instrument choice is being moved into the Historical Backtest control page instead of being forced by Trading Performance page entry
- Trading Performance and Market State Analysis are being separated more cleanly so state-interpretation content stops leaking into the trading-performance layer

## What is already implemented

### Navigation / module structure
- Welcome page exists
- Historical Backtest module homepage exists
- Trading Performance exists under Historical Backtest
- Market State Analysis exists as a separate module area with child pages:
  - State Separation
  - State Transitions
  - State Explanation

### Trading Performance work
- Strategy Variants workspace exists as a unified cross-family page
- Composite / Routing supports selector-driven views
- Trading Performance now has a dedicated `Best Trading Choice by Cluster` block fed from formal cluster evaluation payloads
- cluster-family and cluster-variant best-choice data are now expected to come from formal backend evaluation payloads rather than front-end approximations
- MA variant-id mismatch handling was added in the front end so MA variant curves can render despite summary/curve naming differences
- hover popovers were removed; dictionary access is click-to-open only

### Historical Backtest control page
- Historical Backtest now acts as the control center before entering Trading Performance
- instrument selection has been converted from dropdown intent toward a single-select table
- instrument rows now target meaningful selection-help data such as start date, end date, granularity, and row count instead of raw implementation-path fields
- strategy selection has been converted from dropdown intent toward a multi-select sortable/searchable table
- strategy selection is intended to help the user narrow scope before loading the heavy trading-performance payloads
- artifact checklist exists and includes download buttons/links
- the final execution card is now the place where Trading Performance is loaded and where progress should appear only after load starts
- strategy selection now constrains which family dashboards get loaded for Trading Performance
- loading logic has begun moving toward incremental reuse for still-selected families while clearing caches for families that were explicitly deselected

### Market State Analysis work
- overview/separation/explanation page skeletons exist
- state module can load independently of Trading Performance
- State Explanation has a dedicated controlled sample instrument selector because explanation is allowed to project anonymized states onto a real market sample
- second-module design rule is now clearer: Market State Analysis stays anonymized at the module level, but State Explanation is allowed to use a controlled real-market projection instrument

### Dictionary / terminology work
- dashboard dictionary coverage was expanded substantially
- display terms now increasingly map to mother keys instead of one-key-per-item sprawl
- family-level variant code mother keys now exist for MA / Donchian / Bollinger
- parameter region labels now map to a mother `parameter_region_code` explanation

## Current known issues / unfinished work

### Historical Backtest UX
- instrument selection table still needs more polished selection-help fields beyond the first pass of start/end date, granularity, and row count
- strategy selection table still needs more aggregated cross-instrument metrics (for example return / win rate rolled up across all instruments)
- loading experience still needs smarter incremental reuse when changing strategy selection
- current incremental reuse is only a first pass; deselected families are cleared from cache and same-instrument selected families can be reused, but there is more room to reduce reload cost
- server process stability/hot-reload reliability has intermittently caused the UI to show stale content unless the local server is restarted

### Trading Performance data flow
- load path is still heavier than ideal because large payloads are parsed in-browser
- progress bar is stage-based rather than true byte-level progress
- family equity curves now need to stay scoped to the selected-family set at Load time rather than a single monolithic all-family fetch
- family variant dashboard artifacts are moving to split directory outputs (`summary.json`, `composite.json`, `variants/<variant>.json`) so the workflow stays small-file-first going forward instead of repeatedly growing one family blob
- retained-data policy is also being tightened: keep summary records for all tested variants, but keep full heavy artifacts only for top variants worth deep inspection (currently top 5 per cluster within each family)

### Market State Analysis depth
- State Explanation now has a first real path: dedicated payload + K-line main chart + parameter subchart stack
- representative-window selection and explanation quality still need refinement and validation against the running UI
- State Transitions remains mostly placeholder

## Immediate next priorities

1. finish Historical Backtest as the true control center for instrument + strategy selection + artifact visibility + progress
2. continue refining instrument/strategy selection tables so they help the user choose scope rather than merely exposing controls
3. improve incremental loading/reuse for Trading Performance while keeping memory usage bounded and clearing deselected-family caches
4. continue filling Market State Analysis with real content, especially State Explanation
5. keep docs under `docs/` current as the structure evolves

## Detailed decisions that must stay aligned with implementation

### Historical Backtest homepage
- this page is now the pre-load control center for Trading Performance
- instrument selection should stay as a single-select table
- strategy selection should stay as a multi-select table
- artifact checklist should remain visible before load so the user can see file readiness and size
- the final load/execute card should carry the current selection summary and progress state
- progress should appear only after load begins

### Trading Performance load behavior
- load should be explicitly user-triggered from Historical Backtest instead of auto-triggered by entering Trading Performance
- the load boundary is the Load button, not page navigation
- during one Load, family equity curves should be fetched once for the currently selected families and then reused across page navigation without re-fetching
- instrument changes are a stronger reset boundary than family selection changes
- family-variant dashboard cache may still be trimmed by selected family scope, but page-to-page navigation within the loaded scope must not trigger new equity-curve loads

### Module boundary
- Trading Performance should answer trading questions
- Market State Analysis should answer state/cluster interpretation questions
- cluster best family / cluster best variant belong to Trading Performance because they answer how to trade a cluster
- best region / state separation / state explanation belong to Market State Analysis because they answer what a state is
