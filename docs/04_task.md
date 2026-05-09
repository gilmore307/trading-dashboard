# Task

## Active Tasks

- None for the historical-data training preparation boundary.

`trading-dashboard` is intentionally inactive while the current work is historical data acquisition, offline feature/model training, and evidence generation. Dashboard implementation can wait until there is enough stable read-model evidence to display.

## Historical-Training Todo Status

- No dashboard tasks are required for no-broker historical training.
- Current training evidence can be inspected through manager/storage/model CLI outputs and docs until a first dashboard implementation slice is explicitly accepted.

## Not Current Historical-Training Scope

These items are intentionally outside the current no-broker historical-training run and must not be treated as active dashboard work items:

- first dashboard runtime implementation;
- package/source/test layout before implementation begins;
- read-model surfaces over `task_summary`, promotion decisions, ready signals, or run artifacts;
- dashboard-originated requests, provider calls, model activation, broker execution, or account mutation.

## Recently Accepted

- Closed the current presentation-boundary phase in `docs/07_dashboard_closeout.md`: downstream-only display role, provenance-preserving expectation, no dashboard-originated trading actions, and deferred implementation-layout policy are accepted. No dashboard runtime, provider call, manager dispatch, model activation, broker execution, or account mutation is enabled by this closeout.
- Created initial `trading-dashboard` docs spine and repository boundary.
- Added initial `.gitignore` for local environments, generated outputs, logs, and secrets.
