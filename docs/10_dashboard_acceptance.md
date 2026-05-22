# Dashboard Acceptance

## Status

`trading-dashboard` has an active read-only implementation boundary: a Vite/React dashboard, Python read adapters, CLI helpers, tests, and deployment templates over accepted storage-hosted dashboard read models.

## Accepted Dashboard-Owned Shape

`trading-dashboard` displays already-produced and reviewed outputs. It does not create data truth, model truth, promotion decisions, execution intent, broker orders, or account mutations.

The accepted read-model input route is:

```text
storage/06_dashboard_cache/read_models/<contract_type>/latest.json
  -> /api/read-models/<contract_type>/latest
  -> /ws/read-models/<contract_type>/latest
  -> read-only dashboard presentation
```

The Data page is limited to explicit allowlisted source, feature, and main model-output tables through `/api/data/tables` and `/api/data/query`.

## Boundaries Preserved

This acceptance does not enable dashboard-triggered execution actions, provider calls, model activation, manager dispatch, broker order/fill/account lifecycle, storage read-model writes, arbitrary SQL, or raw internal artifact/receipt browsing as a primary surface.

## Acceptance Evidence

The implementation boundary is acceptable only while these gates pass:

```bash
python3 -m compileall -q src scripts tests
PYTHONPATH=src python3 -m unittest discover -s tests
npm run build
git diff --check
```

No verification command performs provider calls, manager dispatch, model activation, broker execution, account mutation, or storage read-model writes.
