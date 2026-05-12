# trading-dashboard

`trading-dashboard` is the downstream owner-facing UI and visualization repository for the trading system.

It displays already-produced trading outputs through concise dashboards, charts, and explanation adapters without becoming an upstream source of truth, internal maintenance console, artifact explorer, or workflow-control surface.

It does not own component responsibilities outside that boundary, global contracts, shared registry authority, generated runtime artifacts committed to Git, or secrets.

## Top-Level Structure

```text
docs/        Repository scope, context, workflow, acceptance, task, decisions, local memory, and information architecture.
```

Source, scripts, tests, and package layout are intentionally not created yet. Add them only after the component contracts, storage expectations, and first implementation slice are explicit. When implementation begins, use `src/` for importable/reusable code, `scripts/` for executable maintenance or operational entrypoints, and `tests/` for first-party tests; `scripts/` may import `src/`, but `src/` must not import `scripts/`. `docs/07_dashboard_closeout.md` records the current presentation-boundary closeout; it does not enable dashboard runtime or trading actions.

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
