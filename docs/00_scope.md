# Scope

## Purpose

`trading-dashboard` is the downstream UI and visualization repository for the trading system.

It displays already-produced trading outputs through dashboards, endpoints, and visualization adapters without becoming an upstream source of truth.

This repository exists to keep that responsibility explicit, testable, and separate from neighboring trading repositories.

## In Scope

- dashboard UI/server implementation once selected.
- visualization adapters for artifacts, manifests, ready signals, and execution outputs.
- read-only presentation workflows.
- dashboard-local tests for rendering and data adapters.
- user-facing views over accepted outputs.

## Out of Scope

- market data fetching as source of truth.
- strategy backtesting.
- model training or market-state discovery.
- order execution.
- cross-repository promotion decisions.
- shared storage policy.
- Defining global artifact, manifest, ready-signal, request, field, status, or type contracts outside `trading-main`.
- Storing generated data, artifacts, logs, notebooks, credentials, or secrets in Git.

## Owner Intent

`trading-dashboard` should become a disciplined component repository with clear contracts, evidence-backed acceptance, and no hidden ownership drift.

The repository should prefer explicit interfaces, fixture-backed tests, and narrow responsibility boundaries over quick scripts that blur component roles.

## Boundary Rules

- Component-local implementation belongs here only when it matches this repository's role.
- Global contracts, registry entries, shared helpers, and reusable templates belong in `trading-main`.
- Durable storage layout and retention belong in `trading-storage` unless this repository is defining that storage contract.
- Scheduling, retries, lifecycle routing, and promotion decisions belong in the `trading-main` control plane unless explicitly delegated by contract.
- Generated artifacts and runtime outputs are not source files.
- Secrets and credentials must stay outside the repository.
- Shared helpers, templates, fields, statuses, and type values discovered here must be recorded through `trading-main` before cross-repository use.

## Out-of-Scope Signals

A request should be rejected or re-scoped if it asks `trading-dashboard` to:

- take over another component repository responsibility.
- commit generated runtime outputs or secrets.
- define global contracts without routing them through trading-main.
- invent shared fields/statuses/types without registry review.
- bypass accepted storage or manager lifecycle boundaries.
