# Workstream Decisions

_Last updated: 2026-04-05_

## Module boundary decisions

### Welcome
- the site should not drop directly into Trading Performance
- a top-level Welcome page exists so module choice comes first

### Historical Backtest
- Historical Backtest is the control-center module homepage for the first major workflow
- it should handle:
  - instrument selection
  - strategy/family selection
  - artifact readiness/checklist
  - download access
  - load execution and progress
- Trading Performance should not force a modal instrument choice on entry anymore

### Trading Performance
- this module is strictly about trading behavior, returns, routing outcomes, and trade-level results
- it should avoid drifting into state-interpretation or parameter-research semantics
- cluster-related content is allowed here only when it answers a trading question such as:
  - what trades best in this cluster?
  - what family/variant is best in this cluster?

### Market State Analysis
- this module is about state/cluster structure, state separation, state transitions, and explanation
- it should stay largely instrument-anonymized
- `State Explanation` is the one intentional exception where a controlled sample instrument can be used as a real-market projection layer

## Loading / scope decisions

- Historical Backtest should let the user choose either all strategies or a subset before loading Trading Performance
- strategy selection should be a multi-select table, not a single dropdown
- instrument selection should be a single-select table, not a blind dropdown
- instrument table columns should prioritize selection-help fields such as start date, end date, granularity, and row count rather than implementation-only fields like raw derived filenames
- large payload loading should be explicitly user-triggered via the load card at the bottom of Historical Backtest
- the page should show progress only after load starts
- current progress UI should appear below the load button, not above it
- current selection summary should live in the same final execution card instead of floating as a separate top card

## Table behavior decisions

- all tables must support sorting
- large tables should also support search/filtering
- this rule applies even if the current dataset is small or only one row is visible today

## Dictionary / explanation decisions

- avoid one-dictionary-key-per-variant sprawl
- prefer mother-key explanations, for example:
  - `moving_average_variant_code`
  - `donchian_breakout_variant_code`
  - `bollinger_reversion_variant_code`
  - `parameter_region_code`
- concrete labels should point to the right mother key instead of reusing a semantically wrong generic key

## Current implementation caveats

- hot-reload/server stability has intermittently caused the browser to show stale UI until the local server process is restarted
- Historical Backtest controls, progress, and selective loading are mid-refactor and should be revalidated against the running local server after significant edits
- large trading payloads are still heavy enough that progress/status communication remains important even after scope narrowing
- the current incremental cache strategy is intentionally conservative: still-selected families may be reused, but deselected families should be cleared instead of retained indefinitely
