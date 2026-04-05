# 12 Merged repo scope

This document defines the post-merge scope for `trading-report` after absorbing `ops-dashboard`.

## New repository role

`trading-report` becomes the unified downstream repo for:
- report assembly
- dashboard-facing normalized data layers
- visualization UI
- lightweight local serving/adaptation layer
- shared field/dictionary metadata for reporting and visualization

## Internal layers inside the merged repo

### 1. Intake layer
Consumes upstream producer outputs from:
- `trading-data`
- `trading-strategy`
- `trading-model`
- `trading-execution`
- `trading-manager`

### 2. Detail layer
Holds the canonical normalized detail rows and related machine-readable reporting surfaces.

For example in `trading-data` coverage work:
- one row per `symbol + dataset`
- full detail fields live here

### 3. Overview layer
Derived views designed for high-level interaction.

For example in `trading-data` coverage work:
- overview matrix where rows = symbols and columns = datasets
- each cell carries a status summary derived from the detail layer

### 4. Visualization layer
Interactive pages, tables, cards, heatmaps, and drill-down flows.

### 5. Serving / adapter layer
Local endpoint or file-serving layer that exposes normalized outputs to the UI.

### 6. Shared metadata layer
Metric dictionary, field labels, tooltips, and related display metadata.

## Canonical UI interaction rule

Overview surfaces are not the canonical truth layer.
The canonical truth layer is the normalized detail layer.

Interaction rule:
- clicking an overview row filters the detail layer by row key
- clicking an overview column filters the detail layer by column key
- clicking an overview cell filters the detail layer by combined row/column/status scope

## Scope rule

`trading-report` should own:
- unified report schemas
- normalized detail rows
- derived overview matrices/cards/charts
- dashboard UI behavior and contracts
- serving/adaptation layer for the dashboard
- shared dictionary/label/tooltip metadata used by the reporting UI

`trading-report` should not own:
- upstream data acquisition
- strategy simulation internals
- model-training internals
- live execution internals
- cross-repo workflow scheduling logic
