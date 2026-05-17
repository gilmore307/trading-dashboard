# trading-dashboard

`trading-dashboard` is the downstream owner-facing UI and visualization repository for the trading system.

It displays already-produced trading outputs through concise dashboards, charts, and explanation adapters without becoming an upstream source of truth, internal maintenance console, artifact explorer, or workflow-control surface.

It does not own component responsibilities outside that boundary, global contracts, shared registry authority, generated runtime artifacts committed to Git, or secrets.

## Top-Level Structure

```text
deploy/      Host deployment templates for read-only dashboard presentation services.
docs/        Repository scope, context, workflow, acceptance, task, decisions, local memory, and information architecture.
scripts/     Executable dashboard helper entrypoints.
src/         Importable read-only dashboard adapters.
tests/       First-party dashboard adapter tests.
web/         Vite/React browser UI for accepted read-model summaries.
```

The first implementation slice is a read-only storage-hosted read-model adapter plus a Vite/React Historical Modeling page. It does not create workflow controls, provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes. `src/` owns reusable Python adapters, `web/` owns the browser UI, `scripts/` owns executable entrypoints, and `tests/` owns verification; `scripts/` may import `src/`, but `src/` must not import `scripts/`. `docs/10_dashboard_acceptance.md` records the presentation-boundary closeout.

## Docs Spine

```text
docs/
  00_scope.md
  01_context.md
  02_workflow.md
  03_acceptance.md
  04_task.md
  05_decision.md
  06_memory.md
  07_dashboard_closeout.md
  08_information_architecture.md
  09_dashboard_read_models.md
```

## Platform Dependencies

- `trading-manager` owns global contracts, registry, shared helpers, templates, and platform guidance.
- `trading-storage` owns durable storage layout and retention unless this repository is `trading-storage` itself.
- `trading-manager` owns control-plane orchestration and lifecycle routing.

Any new global helper, reusable template, shared field, status, type, config key, or vocabulary discovered here must be routed back to `trading-manager` before other repositories depend on it.

## Verification

```bash
npm run build
npm test
PYTHONPATH=src python3 -m unittest discover -s tests
python3 -m compileall -q src scripts
```
