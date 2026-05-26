# trading-dashboard

`trading-dashboard` is the downstream owner-facing UI and visualization repository for the trading system.

It displays already-produced trading outputs through concise dashboards, charts, and explanation adapters without becoming an upstream source of truth, internal maintenance console, artifact explorer, or workflow-control surface.

It does not own component responsibilities outside that boundary, global contracts, shared registry authority, generated runtime artifacts committed to Git, or secrets.

## Top-Level Structure

```text
deploy/      Host deployment templates for read-only dashboard presentation services.
docs/        Repository scope, context, contracts, tasks, decisions, memory, and dashboard modules.
scripts/     Executable dashboard helper entrypoints.
src/         Importable read-only dashboard adapters.
tests/       First-party dashboard adapter tests.
web/         Vite/React browser UI for accepted read-model summaries.
```

The current implementation is a read-only storage-hosted dashboard over accepted read-model summaries. The Vite/React UI renders Status, Tasks, Timewheel, Data, Models, Realtime Signals, and Diagnostics through direct HTTP/WebSocket latest-summary routes:

```text
/api/read-models/<contract_type>/latest
/ws/read-models/<contract_type>/latest
```

Read-model files are read from the accepted storage route:

```text
storage/06_dashboard_cache/read_models/<contract_type>/latest.json
```

The Data page is the narrow read-only exception for allowlisted source, feature, and main model-output tables through `/api/data/tables` and `/api/data/query`. The dashboard does not create workflow controls, provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes. `src/` owns reusable Python adapters, `web/` owns the browser UI, `scripts/` owns executable entrypoints, and `tests/` owns verification; `scripts/` may import `src/`, but `src/` must not import `scripts/`.

## Docs Spine

```text
docs/
  00_scope.md
  01_context.md
  02_architecture.md
  03_contracts.md
  04_task.md
  05_decision.md
  06_memory.md
  10_dashboard_acceptance.md
  20_information_architecture.md
  30_dashboard_read_models.md
```

## Platform Dependencies

- `trading-manager` owns global contracts, registry, shared helpers, templates, and platform guidance.
- `trading-storage` owns durable storage layout, read-model persistence, and retention.
- `trading-manager` owns control-plane orchestration and lifecycle routing.

Any new global helper, reusable template, shared field, status, type, config key, or vocabulary discovered here must be routed back to `trading-manager` before other repositories depend on it.

## Verification

```bash
python3 -m compileall -q src scripts tests
PYTHONPATH=src python3 -m unittest discover -s tests
npm run build
git diff --check
```
