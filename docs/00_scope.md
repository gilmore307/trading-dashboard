# Scope

## Purpose

`trading-dashboard` is the downstream owner-facing UI and visualization repository for the trading system.

It displays already-produced trading outputs through concise dashboards, charts, and explanation adapters without becoming an upstream source of truth, internal maintenance console, artifact explorer, or workflow-control surface.

This repository exists to keep that responsibility explicit, testable, and separate from neighboring trading repositories.

## In Scope

- dashboard UI/server implementation once selected.
- visualization adapters for artifacts, manifests, ready signals, and execution outputs.
- read-only presentation workflows.
- dashboard-local tests for rendering and data adapters.
- user-facing views over accepted outputs.
- high-level summaries for current status, tasks, model posture, realtime signals, and trading performance.
- contextual explanations for visible registry-backed fields.

## Out of Scope

- market data fetching as source of truth.
- strategy backtesting.
- model training or market-state discovery.
- order execution.
- cross-repository promotion decisions.
- shared storage policy.
- Defining global artifact, manifest, ready-signal, request, field, status, or type contracts outside `trading-manager`.
- exposing internal maintenance surfaces as primary user pages.
- exposing model intermediate artifacts, run manifests, request payloads, ready-signal rows, daemon internals, or raw logs by default.
- Storing generated data, artifacts, logs, notebooks, credentials, or secrets in Git.

## Owner Intent

`trading-dashboard` should become a disciplined owner-facing summary component with clear contracts, evidence-backed acceptance, and no hidden ownership drift.

The repository should prefer explicit interfaces, fixture-backed tests, chart-first presentation, and narrow responsibility boundaries over quick scripts that blur component roles or expose internal system machinery to the owner.

## Boundary Rules

- Component-local implementation belongs here only when it matches this repository's owner-facing summary role.
- Global contracts, registry entries, shared helpers, and reusable templates belong in `trading-manager`.
- Durable storage layout and retention belong in `trading-storage` unless this repository is defining that storage contract.
- Scheduling, retries, lifecycle routing, and promotion decisions belong in the `trading-manager` control plane unless explicitly delegated by contract.
- Generated artifacts and runtime outputs are not source files.
- Secrets and credentials must stay outside the repository.
- Shared helpers, templates, fields, statuses, and type values discovered here must be recorded through `trading-manager` before cross-repository use.
- Internal details may be reachable only through advanced diagnostic drilldowns when needed to explain a visible owner-facing status, blocker, model issue, signal issue, or performance anomaly.

## Out-of-Scope Signals

A request should be rejected or re-scoped if it asks `trading-dashboard` to:

- take over another component repository responsibility.
- commit generated runtime outputs or secrets.
- define global contracts without routing them through trading-manager.
- invent shared fields/statuses/types without registry review.
- make internal maintenance, artifact, manifest, ready-signal, request, or daemon-detail views primary navigation.
- bypass accepted storage or manager lifecycle boundaries.
