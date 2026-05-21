from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from trading_dashboard.read_models import (
    DashboardReadModelAdapterError,
    HISTORICAL_TASK_PROGRESS_CONTRACT,
    read_dashboard_read_model_latest,
    read_historical_task_progress_latest,
)


def sample_payload(**overrides):
    payload = {
        "contract_type": HISTORICAL_TASK_PROGRESS_CONTRACT,
        "schema_version": 1,
        "generated_at_utc": "2026-05-12T00:00:00Z",
        "source_system": "trading-manager",
        "status": "running",
        "severity": "info",
        "summary": "Historical scheduler is running at Layer 1 data acquisition.",
        "chart_payload": {
            "current_month": "2016-01",
            "active_stage": "layer_01_market_regime.data_acquisition",
            "progress_percent": 12.5,
            "stage_counts": {"succeeded": 1, "pending": 7},
        },
        "profile_refs": [],
        "issue_refs": [],
        "diagnostic_refs": [{"ref_type": "manager_historical_scheduler_status"}],
        "lineage_refs": [{"contract_type": "manager_historical_scheduler_status"}],
        "freshness": {"class": "runtime_status_snapshot", "status": "fresh", "stale_after_seconds": 900},
        "schema_ref": "storage/06_dashboard_cache/schemas/historical_task_progress_summary.schema.json",
    }
    payload.update(overrides)
    return payload


def write_latest(storage_root: Path, payload: dict) -> Path:
    latest = storage_root / "06_dashboard_cache" / "read_models" / payload["contract_type"] / "latest.json"
    latest.parent.mkdir(parents=True, exist_ok=True)
    latest.write_text(json.dumps(payload), encoding="utf-8")
    return latest


class DashboardReadModelAdapterTests(unittest.TestCase):
    def test_reads_historical_task_progress_latest_as_ui_view(self):
        with tempfile.TemporaryDirectory() as tmp:
            storage_root = Path(tmp)
            latest = write_latest(storage_root, sample_payload())

            view = read_historical_task_progress_latest(storage_root=storage_root)

        self.assertEqual(view.contract_type, HISTORICAL_TASK_PROGRESS_CONTRACT)
        self.assertEqual(view.status, "running")
        self.assertEqual(view.chart_payload["progress_percent"], 12.5)
        self.assertEqual(view.latest_path, latest)
        self.assertEqual(view.as_dict()["summary"], "Historical scheduler is running at Layer 1 data acquisition.")

    def test_rejects_unsafe_contract_type(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(DashboardReadModelAdapterError):
                read_dashboard_read_model_latest("../historical_task_progress_summary", storage_root=Path(tmp))

    def test_rejects_missing_latest_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(DashboardReadModelAdapterError):
                read_historical_task_progress_latest(storage_root=Path(tmp))

    def test_rejects_contract_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            storage_root = Path(tmp)
            latest = storage_root / "06_dashboard_cache" / "read_models" / HISTORICAL_TASK_PROGRESS_CONTRACT / "latest.json"
            latest.parent.mkdir(parents=True, exist_ok=True)
            latest.write_text(
                json.dumps(sample_payload(contract_type="current_system_status_summary")),
                encoding="utf-8",
            )

            with self.assertRaises(DashboardReadModelAdapterError):
                read_historical_task_progress_latest(storage_root=storage_root)

    def test_cli_reads_latest_view(self):
        with tempfile.TemporaryDirectory() as tmp:
            storage_root = Path(tmp)
            write_latest(storage_root, sample_payload())

            from scripts.read_models.read_latest_dashboard_read_model import main

            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = main([HISTORICAL_TASK_PROGRESS_CONTRACT, "--storage-root", str(storage_root)])

        self.assertEqual(result, 0)
        view = json.loads(output.getvalue())
        self.assertEqual(view["contract_type"], HISTORICAL_TASK_PROGRESS_CONTRACT)
        self.assertEqual(view["status"], "running")


if __name__ == "__main__":
    unittest.main()
