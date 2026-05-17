# Context

## Why This Repository Exists

The trading platform is split across multiple repositories so each major responsibility has a clear owner. `trading-dashboard` exists because Chentong needs a concise owner-facing summary of system posture, model posture, realtime signal posture, and trading performance. It displays already-produced trading outputs through dashboards, charts, and explanation adapters without becoming an upstream source of truth or internal maintenance console.

## Related Systems

| System | Relationship |
|---|---|
| `trading-manager` | Owns global architecture, registry, templates, shared helpers, and cross-repository contracts. |
| `trading-manager` control plane | Owns orchestration, lifecycle, scheduling, retries, requests, and promotion routing. |
| `trading-data` | Produces data artifacts, manifests, and ready signals. |
| `trading-storage` | Owns durable storage layout, retention, archive, backup, restore, and artifact placement rules. |
| `trading-strategy` | Produces strategy research and backtest artifacts. |
| `trading-model` | Produces offline model/state research outputs and verdicts. |
| `trading-execution` | Consumes promoted decisions for paper/live execution. |
| `trading-dashboard` | Presents owner-facing summaries over already-produced outputs, while hiding internal maintenance machinery by default. |

## Expected External Interfaces

Potential external interfaces include:

- trading-storage read paths.
- trading-manager contracts.
- component artifacts/manifests/signals.

Specific providers, credentials, package choices, deployment targets, and runtime settings are not settled unless recorded in this repository's decisions or inherited from `trading-manager` contracts.

## Environment

Development is server-hosted under `/root/projects/trading-dashboard`.

The shared Python environment is anchored by `trading-manager` at:

```text
/root/projects/trading-manager/.venv
```

`trading-dashboard` should not create an independent virtual environment unless a documented exception is accepted.

## Dependencies

Current system-level dependencies:

- `trading-manager/docs/30_helpers.md` for shared helper policy;
- `trading-manager/docs/10_registry.md` for registry operating rules;
- `trading-manager/docs/11_templates.md` and `trading-manager/templates/` for reusable drafting surfaces;
- `trading-manager/requirements.txt` for reviewed shared Python dependencies;
- related component repositories through accepted contracts, not internal implementation details.

## Global Registration Discipline

If this repository introduces a name that other repositories may consume, route it back to `trading-manager` before treating it as stable.

This includes shared fields, artifact types, manifest types, ready-signal types, request types, status values, global helper methods, reusable templates, config keys, and provider-independent terminology.

## Important Constraints

- Do not store generated artifacts, logs, notebooks, credentials, or secrets in Git.
- Keep component-local implementation inside this repository's boundary.
- Use manifests, ready signals, artifact references, and requests for cross-repository handoffs once contracts are accepted.
- Do not depend on another component's internal implementation details.
