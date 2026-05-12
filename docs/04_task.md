# Task

## Active Tasks

- Define the owner-facing dashboard information architecture, product boundary, and read-model contracts before implementation.

`trading-dashboard` is moving from inactive presentation-boundary closeout into documentation-only page-structure design. Runtime/code implementation remains deferred until the first owner-facing read-model slice is explicitly accepted.

## Historical-Training Todo Status

- No dashboard tasks are required for no-broker historical training.
- Current training evidence can be inspected through manager/storage/model CLI outputs and docs until a first dashboard implementation slice is explicitly accepted.

## Not Current Scope

These items are intentionally outside the current no-broker historical-training run and must not be treated as active dashboard work items:

- first dashboard runtime implementation;
- package/source/test layout before implementation begins;
- primary pages exposing maintenance internals, model intermediate artifacts, manager request payloads, run manifests, ready signals, raw receipts, or daemon implementation details;
- read-model surfaces over owner-facing current status, task progress, model posture, realtime signals, or trading performance before their presentation contract is accepted in `docs/09_dashboard_read_models.md`;
- dashboard-originated requests, provider calls, model activation, broker execution, or account mutation.

## Recently Accepted

- Closed the current presentation-boundary phase in `docs/07_dashboard_closeout.md`: downstream-only display role, provenance-preserving expectation, no dashboard-originated trading actions, and deferred implementation-layout policy are accepted. No dashboard runtime, provider call, manager dispatch, model activation, broker execution, or account mutation is enabled by this closeout.
- Created initial `trading-dashboard` docs spine and repository boundary.
- Added initial `.gitignore` for local environments, generated outputs, logs, and secrets.

## Proposed Primary Tabs

- Current Status — high-level server/resource/API/service/scheduler/realtime posture, with alert summary.
- Alerts and Exceptions — owner-actionable unresolved issues, severity, impact, and suggested next action.
- Tasks — historical modeling and realtime trading subtabs, focused on owner-facing progress/blockers.
- Models — eight layer subtabs for parameters, version/update history, performance, and promotion posture.
- Realtime Trading Signals — parked until realtime components are stable enough to provide meaningful signal summaries.
- Trading Performance Summary — parked until live trading produces stable performance evidence.
- Registry Dictionary — read-only searchable explanation surface for accepted fields, terms, statuses, contracts, configs, and scripts.

Registry-backed field profiles remain contextual hover/detail explanations for visible fields and can link into the Registry Dictionary.

## First Implementation Candidate

The first runtime slice should target only:

1. Current Status;
2. Alerts and Exceptions;
3. Tasks;
4. Models summary;
5. Registry Dictionary / hover profiles.

Realtime Trading Signals and Trading Performance Summary remain parked until mature realtime/trading evidence exists.
