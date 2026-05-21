# systemd

Systemd unit templates for the dashboard presentation layer.

- `trading-dashboard-web.service` builds and serves the Vite dashboard UI with read-only HTTP/WebSocket access to storage-hosted dashboard read models.
- The service must not create provider calls, manager dispatch, model activation, broker execution, account mutation, or storage writes beyond the Vite build output under `dist/`.
- The host Python environment used by the service must have the project dependencies from `pyproject.toml` installed, including `psycopg`, because the read-only Data page shells through the Python table helper.
