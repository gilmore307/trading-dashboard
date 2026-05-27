"""Read-only dashboard data and model-output table explorer helpers.

This module intentionally exposes an allowlisted table catalog rather
than a raw SQL console. The dashboard may search, filter, sort, and page through
approved source, feature, and model-output tables only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence


class DataTableError(RuntimeError):
    """Raised when a dashboard data-table request is invalid or unavailable."""


@dataclass(frozen=True)
class DataTableSpec:
    table_id: str
    label: str
    schema: str
    table: str
    description: str
    default_sort: str
    default_direction: str = "asc"
    preferred_columns: tuple[str, ...] = ()


ALLOWED_TABLES: tuple[DataTableSpec, ...] = (
    DataTableSpec(
        table_id="market_regime_bars",
        label="trading_data.m01_market_regime_data_acquisition",
        schema="trading_data",
        table="m01_market_regime_data_acquisition",
        description="Downloaded bar rows for the reviewed market/sector ETF universe.",
        default_sort="symbol",
    ),
    DataTableSpec(
        table_id="target_state_bars_quotes",
        label="trading_data.m03_target_state_vector_data_acquisition",
        schema="trading_data",
        table="source_03_target_state",
        description="Downloaded target-symbol bars and quote-derived fields used by target-state inputs.",
        default_sort="target_candidate_id",
    ),
    DataTableSpec(
        table_id="event_risk_governor_events",
        label="trading_data.m10_event_risk_governor_data_acquisition",
        schema="trading_data",
        table="source_10_event_risk_governor",
        description="Downloaded/normalized event rows used by the event-risk-governor source.",
        default_sort="event_time",
        default_direction="desc",
        preferred_columns=(
            "event_category_type",
            "information_role_type",
            "event_time",
            "available_time",
            "scope_type",
            "symbol",
            "sector_type",
            "title",
            "summary",
            "source_name",
            "event_id",
            "canonical_event_id",
            "dedup_status",
            "reference_type",
            "reference",
        ),
    ),
    DataTableSpec(
        table_id="market_regime_features",
        label="trading_data.m01_market_regime_feature_generation",
        schema="trading_data",
        table="m01_market_regime_feature_generation",
        description="Generated market-regime feature payloads derived from downloaded source bars.",
        default_sort="snapshot_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="market_regime_model_output",
        label="trading_model.m01_market_regime_model_generation",
        schema="trading_model",
        table="model_01_market_regime",
        description="Market-regime model output rows generated from reviewed Layer 1 features.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="sector_context_features",
        label="trading_data.m02_sector_context_feature_generation",
        schema="trading_data",
        table="m02_sector_context_feature_generation",
        description="Generated sector-context feature payloads derived from downloaded source bars.",
        default_sort="snapshot_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="sector_context_model_output",
        label="trading_model.m02_sector_context_model_generation",
        schema="trading_model",
        table="model_02_sector_context",
        description="Sector-context model output rows generated from reviewed Layer 2 features.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="target_state_features",
        label="trading_data.m03_target_state_vector_feature_generation",
        schema="trading_data",
        table="feature_03_target_state_vector",
        description="Generated target-state feature vectors derived from downloaded target data.",
        default_sort="target_candidate_id",
    ),
    DataTableSpec(
        table_id="target_state_model_output",
        label="trading_model.m03_target_state_vector_model_generation",
        schema="trading_model",
        table="model_03_target_state_vector",
        description="Target-state model output rows generated from reviewed Layer 3 features.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="event_failure_risk_model_output",
        label="trading_model.m04_event_failure_risk_model_generation",
        schema="trading_model",
        table="model_04_event_failure_risk",
        description="Event-failure-risk model output rows generated from reviewed Layer 4 context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="alpha_confidence_model_output",
        label="trading_model.m05_alpha_confidence_model_generation",
        schema="trading_model",
        table="model_05_alpha_confidence",
        description="Alpha-confidence model output rows generated from upstream state and event context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="dynamic_risk_policy_model_output",
        label="trading_model.m06_dynamic_risk_policy_model_generation",
        schema="trading_model",
        table="model_06_dynamic_risk_policy",
        description="Dynamic-risk-policy model output rows generated from market, event, alpha, and portfolio context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="position_projection_model_output",
        label="trading_model.m07_position_projection_model_generation",
        schema="trading_model",
        table="model_07_position_projection",
        description="Position-projection model output rows generated from alpha confidence, risk policy, and position context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="underlying_action_model_output",
        label="trading_model.m08_underlying_action_model_generation",
        schema="trading_model",
        table="model_08_underlying_action",
        description="Underlying-action model output rows generated from position projection and upstream context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="option_expression_model_output",
        label="trading_model.m09_option_expression_model_generation",
        schema="trading_model",
        table="model_09_option_expression",
        description="Option-expression model output rows generated from underlying-action and option-chain context.",
        default_sort="available_time",
        default_direction="desc",
    ),
    DataTableSpec(
        table_id="event_risk_governor_features",
        label="trading_data.m10_event_risk_governor_feature_generation",
        schema="trading_data",
        table="feature_10_event_risk_governor",
        description="Generated event-risk-governor feature payloads derived from downloaded event rows.",
        default_sort="event_id",
    ),
    DataTableSpec(
        table_id="event_risk_governor_model_output",
        label="trading_model.m10_event_risk_governor_model_generation",
        schema="trading_model",
        table="model_10_event_risk_governor",
        description="Event-risk-governor model output rows generated from reviewed Layer 10 feature/context inputs.",
        default_sort="available_time",
        default_direction="desc",
    ),
)

_TABLE_BY_ID = {table.table_id: table for table in ALLOWED_TABLES}
_LAYERED_TABLE_RE = re.compile(r"^(source|feature|model)_(\d{2})_")
_NUMBERED_STAGE_TABLE_RE = re.compile(r"^m(\d{2})_.*_(data_acquisition|feature_generation|model_generation)$")
_SURFACE_ORDER = {"source": 0, "feature": 1, "model": 2}
_STAGE_SURFACE_ORDER = {"data_acquisition": 0, "feature_generation": 1, "model_generation": 2}
MAX_LIMIT = 200
DEFAULT_LIMIT = 50


def database_url(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    env = os.environ.get("DATABASE_URL") or os.environ.get("OPENCLAW_DATABASE_URL")
    if env:
        return env
    secret_path = Path("/root/secrets/openclaw/database-url")
    if secret_path.exists():
        return secret_path.read_text(encoding="utf-8").strip()
    raise DataTableError("database URL is not configured")


def _catalog_sort_key(table: DataTableSpec) -> tuple[int, int, str]:
    match = _LAYERED_TABLE_RE.match(table.table)
    if not match:
        numbered_match = _NUMBERED_STAGE_TABLE_RE.match(table.label.split(".", 1)[-1])
        if not numbered_match:
            return (99, 99, table.label)
        layer, surface = numbered_match.groups()
        return (int(layer), _STAGE_SURFACE_ORDER[surface], table.label)
    surface, layer = match.groups()
    return (int(layer), _SURFACE_ORDER[surface], table.label)


def table_catalog() -> list[dict[str, str]]:
    return [asdict(table) for table in sorted(ALLOWED_TABLES, key=_catalog_sort_key)]


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _table_sql(table: DataTableSpec) -> str:
    return f"{_quote_identifier(table.schema)}.{_quote_identifier(table.table)}"


def _normalize_limit(value: int | None) -> int:
    if value is None:
        return DEFAULT_LIMIT
    return max(1, min(MAX_LIMIT, value))


def _normalize_offset(value: int | None) -> int:
    if value is None:
        return 0
    return max(0, value)


def _json_default(value: Any) -> str | float | int | None:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value) if value is not None else None


def _column_label(column_name: str) -> str:
    labels = {
        "event_category_type": "event_type",
        "information_role_type": "information_role",
        "scope_type": "event_scope",
        "source_name": "event_source",
    }
    return labels.get(column_name, column_name)


def _column_metadata(connection: Any, table: DataTableSpec) -> list[dict[str, str]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position ASC
            """,
            (table.schema, table.table),
        )
        rows = cursor.fetchall()
    metadata = [{"name": str(row[0]), "label": _column_label(str(row[0])), "data_type": str(row[1])} for row in rows]
    if not table.preferred_columns:
        return metadata
    order = {column: index for index, column in enumerate(table.preferred_columns)}
    return sorted(metadata, key=lambda column: (order.get(column["name"], len(order)), column["name"]))


def _where_clause(
    *,
    columns: Sequence[str],
    search: str | None,
    filters: Mapping[str, str] | None,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    searchable_columns = list(columns[:32])
    if search:
        params["search"] = f"%{search}%"
        clauses.append("(" + " OR ".join(f"{_quote_identifier(column)}::text ILIKE %(search)s" for column in searchable_columns) + ")")
    for index, (column, value) in enumerate((filters or {}).items()):
        if column not in columns or value == "":
            continue
        key = f"filter_{index}"
        params[key] = f"%{value}%"
        clauses.append(f"{_quote_identifier(column)}::text ILIKE %({key})s")
    return (" WHERE " + " AND ".join(clauses) if clauses else "", params)


def query_table(
    table_id: str,
    *,
    database_url_value: str | None = None,
    search: str | None = None,
    filters: Mapping[str, str] | None = None,
    sort: str | None = None,
    direction: str = "asc",
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, Any]:
    table = _TABLE_BY_ID.get(table_id)
    if not table:
        raise DataTableError(f"unknown dashboard data table: {table_id}")
    import psycopg

    limit_value = _normalize_limit(limit)
    offset_value = _normalize_offset(offset)
    with psycopg.connect(database_url(database_url_value)) as connection:
        columns_metadata = _column_metadata(connection, table)
        columns = [column["name"] for column in columns_metadata]
        if not columns:
            raise DataTableError(f"approved table has no visible columns: {table_id}")
        where_sql, params = _where_clause(columns=columns, search=search, filters=filters)
        sort_column = sort if sort in columns else table.default_sort if table.default_sort in columns else columns[0]
        selected_direction = direction if sort else table.default_direction
        sort_direction = "DESC" if selected_direction.lower() == "desc" else "ASC"
        base_sql = _table_sql(table)
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT count(*) FROM {base_sql}{where_sql}", params)
            total = int(cursor.fetchone()[0])
            select_columns_sql = ", ".join(_quote_identifier(column) for column in columns)
            query_params = {**params, "limit": limit_value, "offset": offset_value}
            cursor.execute(
                f"SELECT {select_columns_sql} FROM {base_sql}{where_sql} ORDER BY {_quote_identifier(sort_column)} {sort_direction} NULLS LAST LIMIT %(limit)s OFFSET %(offset)s",
                query_params,
            )
            rows = [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
    return {
        "table": asdict(table),
        "columns": columns_metadata,
        "rows": json.loads(json.dumps(rows, default=_json_default)),
        "total": total,
        "limit": limit_value,
        "offset": offset_value,
        "sort": sort_column,
        "direction": sort_direction.lower(),
    }


def _load_filters(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    payload = json.loads(value)
    if not isinstance(payload, dict):
        raise DataTableError("filters must be a JSON object")
    return {str(key): str(item) for key, item in payload.items() if item is not None}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only dashboard data table helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("list")
    query = subparsers.add_parser("query")
    query.add_argument("--table", required=True)
    query.add_argument("--search")
    query.add_argument("--filters-json")
    query.add_argument("--sort")
    query.add_argument("--direction", default="asc")
    query.add_argument("--limit", type=int)
    query.add_argument("--offset", type=int)
    query.add_argument("--database-url")
    args = parser.parse_args(argv)
    try:
        if args.command == "list":
            payload = {"tables": table_catalog()}
        else:
            payload = query_table(
                args.table,
                database_url_value=args.database_url,
                search=args.search,
                filters=_load_filters(args.filters_json),
                sort=args.sort,
                direction=args.direction,
                limit=args.limit,
                offset=args.offset,
            )
        print(json.dumps(payload, default=_json_default))
    except Exception as error:  # pragma: no cover - CLI boundary
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
