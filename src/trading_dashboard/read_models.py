"""Read adapters for storage-hosted dashboard read models.

The dashboard consumes compact owner-facing summaries from trading-storage.  This
module intentionally reads only accepted current read-model files and
projects them into UI-ready dictionaries.  It does not query raw component
internals, call providers, activate models, submit broker orders, or mutate
accounts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

DEFAULT_STORAGE_ROOT = Path("/root/projects/trading-storage/storage")
HISTORICAL_TASK_PROGRESS_CONTRACT = "historical_task_progress_summary"
REGISTERED_DASHBOARD_READ_MODELS = frozenset(
    {
        "current_system_status_summary",
        "alert_exception_summary",
        HISTORICAL_TASK_PROGRESS_CONTRACT,
        "temporal_explorer_summary",
        "realtime_task_progress_summary",
        "model_readiness_summary",
        "model_promotion_posture_summary",
        "model_group_replay_review_summary",
        "registry_dictionary_profile",
        "realtime_signal_summary",
        "execution_realtime_trading_runtime_status",
        "runtime_decision_quality_summary",
        "trading_performance_summary",
        "storage_lifecycle_status_summary",
    }
)
REQUIRED_FIELDS = (
    "contract_type",
    "schema_version",
    "generated_at_utc",
    "source_system",
    "status",
    "summary",
    "chart_payload",
    "profile_refs",
    "issue_refs",
    "diagnostic_refs",
    "lineage_refs",
    "freshness",
    "schema_ref",
)
SAFE_CONTRACT_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class DashboardReadModelAdapterError(ValueError):
    """Raised when a storage-hosted dashboard read model cannot be adapted."""


@dataclass(frozen=True)
class DashboardReadModelView:
    """UI-ready view of one storage-hosted dashboard read model."""

    contract_type: str
    schema_version: int
    generated_at_utc: str
    source_system: str
    status: str
    severity: str | None
    summary: str
    chart_payload: Any
    profile_refs: list[Any]
    issue_refs: list[Any]
    diagnostic_refs: list[Any]
    lineage_refs: list[Any]
    freshness: dict[str, Any]
    schema_ref: str
    latest_path: Path

    def as_dict(self) -> dict[str, Any]:
        return {
            "contract_type": self.contract_type,
            "schema_version": self.schema_version,
            "generated_at_utc": self.generated_at_utc,
            "source_system": self.source_system,
            "status": self.status,
            "severity": self.severity,
            "summary": self.summary,
            "chart_payload": self.chart_payload,
            "profile_refs": self.profile_refs,
            "issue_refs": self.issue_refs,
            "diagnostic_refs": self.diagnostic_refs,
            "lineage_refs": self.lineage_refs,
            "freshness": self.freshness,
            "schema_ref": self.schema_ref,
            "latest_path": str(self.latest_path),
        }


def _safe_contract_type(contract_type: str) -> str:
    if not isinstance(contract_type, str) or not SAFE_CONTRACT_RE.fullmatch(contract_type):
        raise DashboardReadModelAdapterError(f"unsafe dashboard read-model contract_type: {contract_type!r}")
    if contract_type not in REGISTERED_DASHBOARD_READ_MODELS:
        raise DashboardReadModelAdapterError(f"unregistered dashboard read-model contract_type: {contract_type!r}")
    return contract_type


def latest_read_model_path(storage_root: Path, contract_type: str) -> Path:
    """Return the accepted storage-hosted current path for a read-model contract."""

    contract_type = _safe_contract_type(contract_type)
    return Path(storage_root) / "06_dashboard_cache" / "read_models" / f"{contract_type}.json"


def _expect_list(payload: Mapping[str, Any], field: str) -> list[Any]:
    value = payload.get(field)
    if not isinstance(value, list):
        raise DashboardReadModelAdapterError(f"{field} must be a JSON array")
    return value


def _adapt_payload(payload: Mapping[str, Any], *, expected_contract_type: str, latest_path: Path) -> DashboardReadModelView:
    missing = [field for field in REQUIRED_FIELDS if field not in payload]
    if missing:
        raise DashboardReadModelAdapterError("missing required dashboard read-model fields: " + ", ".join(missing))
    contract_type = _safe_contract_type(str(payload["contract_type"]))
    if contract_type != expected_contract_type:
        raise DashboardReadModelAdapterError(
            f"current payload contract_type {contract_type!r} does not match expected {expected_contract_type!r}"
        )
    schema_version = payload["schema_version"]
    if not isinstance(schema_version, int) or schema_version < 1:
        raise DashboardReadModelAdapterError("schema_version must be a positive integer")
    for field in ("generated_at_utc", "source_system", "status", "summary", "schema_ref"):
        if not isinstance(payload[field], str) or not payload[field].strip():
            raise DashboardReadModelAdapterError(f"{field} must be a non-empty string")
    if not isinstance(payload["chart_payload"], (dict, list)):
        raise DashboardReadModelAdapterError("chart_payload must be a JSON object or array")
    if not isinstance(payload["freshness"], dict):
        raise DashboardReadModelAdapterError("freshness must be a JSON object")
    severity = payload.get("severity")
    if severity is not None and not isinstance(severity, str):
        raise DashboardReadModelAdapterError("severity must be a string or null")
    return DashboardReadModelView(
        contract_type=contract_type,
        schema_version=schema_version,
        generated_at_utc=str(payload["generated_at_utc"]),
        source_system=str(payload["source_system"]),
        status=str(payload["status"]),
        severity=severity,
        summary=str(payload["summary"]),
        chart_payload=payload["chart_payload"],
        profile_refs=_expect_list(payload, "profile_refs"),
        issue_refs=_expect_list(payload, "issue_refs"),
        diagnostic_refs=_expect_list(payload, "diagnostic_refs"),
        lineage_refs=_expect_list(payload, "lineage_refs"),
        freshness=dict(payload["freshness"]),
        schema_ref=str(payload["schema_ref"]),
        latest_path=latest_path,
    )


def read_dashboard_read_model_latest(
    contract_type: str,
    *,
    storage_root: Path = DEFAULT_STORAGE_ROOT,
) -> DashboardReadModelView:
    """Read and adapt one storage-hosted dashboard read-model current file."""

    contract_type = _safe_contract_type(contract_type)
    latest_path = latest_read_model_path(Path(storage_root), contract_type)
    if not latest_path.exists():
        raise DashboardReadModelAdapterError(f"dashboard read-model current file does not exist: {latest_path}")
    payload = json.loads(latest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise DashboardReadModelAdapterError("dashboard read-model current payload must be a JSON object")
    return _adapt_payload(payload, expected_contract_type=contract_type, latest_path=latest_path)


def read_historical_task_progress_latest(*, storage_root: Path = DEFAULT_STORAGE_ROOT) -> DashboardReadModelView:
    """Read the accepted historical task-progress dashboard summary."""

    return read_dashboard_read_model_latest(HISTORICAL_TASK_PROGRESS_CONTRACT, storage_root=storage_root)


__all__ = [
    "DEFAULT_STORAGE_ROOT",
    "HISTORICAL_TASK_PROGRESS_CONTRACT",
    "REGISTERED_DASHBOARD_READ_MODELS",
    "DashboardReadModelAdapterError",
    "DashboardReadModelView",
    "latest_read_model_path",
    "read_dashboard_read_model_latest",
    "read_historical_task_progress_latest",
]
