# Contracts

## Acceptance Summary

`trading-dashboard` is accepted when it provides a clear, testable component boundary for its role in the trading system.

Acceptance focuses on:

- repository boundary clarity;
- owner-facing information architecture clarity;
- workflow clarity;
- compatibility with `trading-manager` contracts and registry rules;
- compatibility with `trading-storage` where durable artifacts are involved;
- clear separation between user-facing summaries and internal maintenance/intermediate artifacts;
- dashboard consumption of accepted owner-facing summary/read-model contracts rather than raw internal control-plane tables as primary UI inputs;
- absence of committed generated outputs, logs, notebooks, credentials, and secrets;
- evidence-backed tests once code exists.

## Acceptance Rules

### For Documentation Changes

Documentation changes are acceptable when they:

- update the narrowest authoritative file;
- preserve separation between scope, context, workflow, acceptance, task, decision, and memory;
- route global helper, template, field, status, type, and shared vocabulary changes to `trading-manager`;
- mark unresolved contract/storage/runtime questions as open gaps;
- avoid pretending implementation choices are settled before evidence exists;
- keep internal maintenance and intermediate-artifact surfaces out of primary navigation unless explicitly accepted;
- document any new dashboard read model in `docs/30_dashboard_read_models.md`, route its shared name through `trading-manager`, and ensure `trading-storage` has a storage layout/schema boundary before implementation consumes it.

### For Implementation Changes

Implementation changes are acceptable only when they:

- stay inside this repository's component boundary;
- avoid committing generated data, artifacts, logs, notebooks, credentials, or secrets;
- include meaningful tests for the behavior introduced;
- avoid external side effects in default tests unless explicitly guarded;
- use accepted contracts for cross-repository handoffs;
- route new shared names through `trading-manager/scripts/`.

## Verification Commands

Current documentation-stage checks:

```bash
git status --short
find docs -maxdepth 1 -type f | sort
find . -maxdepth 2 -type f | sort
```

Current implementation verification:

```bash
npm run build
npm test
PYTHONPATH=src python3 -m unittest discover -s tests
python3 -m compileall -q src scripts
```

Future runtime/UI slices must add appropriate fixture tests, lint/type checks, schema validation, and artifact/manifest/ready-signal validation as applicable.

## Required Review Evidence

Every accepted change should provide:

- changed files;
- boundary impact;
- contract impact;
- registry impact;
- storage impact;
- test/verification output;
- confirmation that no generated outputs, logs, notebooks, credentials, or secrets were committed;
- unresolved gaps routed to `docs/04_task.md`.

## Rejection Reasons

A change must be rejected or returned if it:

- takes over another component repository responsibility.
- commits generated outputs, logs, notebooks, or credentials.
- invents shared fields/statuses/types without trading-manager registry review.
- stores secret values.
- writes artifacts to undocumented paths.
- claims acceptance without test or inspection evidence.
- duplicates global contract definitions locally instead of referencing trading-manager.
