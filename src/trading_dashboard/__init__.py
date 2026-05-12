"""Dashboard read adapters for storage-hosted trading summaries."""

from .read_models import (
    DashboardReadModelAdapterError,
    DashboardReadModelView,
    read_dashboard_read_model_latest,
    read_historical_task_progress_latest,
)

__all__ = [
    "DashboardReadModelAdapterError",
    "DashboardReadModelView",
    "read_dashboard_read_model_latest",
    "read_historical_task_progress_latest",
]
