# Read-Model Scripts

Executable helpers for dashboard-side reads of storage-hosted dashboard read models.

- `read_latest_dashboard_read_model.py` reads one accepted `latest.json` file under `storage/dashboard/read_models/<contract_type>/` and prints a UI-ready JSON view.

This helper is read-only. It does not call providers, activate models, dispatch manager work, submit broker orders, mutate accounts, or write storage artifacts.
