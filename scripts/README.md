# scripts

Executable dashboard helper entrypoints live here. Scripts may import `src/`; `src/` must not import `scripts/`.

## Read-model helpers

- `read_models/read_latest_dashboard_read_model.py` reads one accepted storage-hosted dashboard read-model `latest.json` file and prints a UI-ready JSON view.

Example:

```bash
PYTHONPATH=src python3 scripts/read_models/read_latest_dashboard_read_model.py \
  historical_task_progress_summary_v1 \
  --storage-root /root/projects/trading-storage/storage
```
