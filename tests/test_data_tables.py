from __future__ import annotations

import unittest

from trading_dashboard.data_tables import _TABLE_BY_ID, _column_label, _non_empty_column_metadata, table_catalog, _where_clause


class _FakeCursor:
    def __init__(self, row: tuple[int, ...]):
        self.row = row

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, _sql: str, _params: object) -> None:
        return None

    def fetchone(self) -> tuple[int, ...]:
        return self.row


class _FakeConnection:
    def __init__(self, row: tuple[int, ...]):
        self.row = row

    def cursor(self) -> _FakeCursor:
        return _FakeCursor(self.row)


class DataTablesTest(unittest.TestCase):
    def test_catalog_exposes_allowlisted_data_and_model_output_tables(self) -> None:
        table_ids = {row["table_id"] for row in table_catalog()}
        self.assertIn("market_regime_bars", table_ids)
        self.assertIn("target_state_bars_quotes", table_ids)
        self.assertIn("event_risk_governor_events", table_ids)
        self.assertIn("market_regime_model_output", table_ids)
        self.assertIn("option_expression_model_output", table_ids)
        self.assertIn("event_risk_governor_model_output", table_ids)
        self.assertNotIn("manager_requests", table_ids)
        self.assertNotIn("model_dataset_snapshot", table_ids)

    def test_catalog_orders_tables_by_layer_then_surface(self) -> None:
        table_ids = [row["table_id"] for row in table_catalog()]
        self.assertEqual(
            table_ids,
            [
                "market_regime_bars",
                "market_regime_features",
                "market_regime_model_output",
                "sector_context_features",
                "sector_context_model_output",
                "target_state_bars_quotes",
                "target_state_features",
                "target_state_model_output",
                "event_failure_risk_model_output",
                "alpha_confidence_model_output",
                "position_projection_model_output",
                "underlying_action_model_output",
                "option_expression_model_output",
                "event_risk_governor_events",
                "event_risk_governor_features",
                "event_risk_governor_model_output",
            ],
        )

    def test_catalog_labels_layer_owned_tables_with_layer_and_flow_prefixes(self) -> None:
        labels = {row["table_id"]: row["label"] for row in table_catalog()}
        self.assertEqual(labels["market_regime_bars"], "Layer 01 · Source · Market Regime Bars")
        self.assertEqual(labels["market_regime_features"], "Layer 01 · Features · Market Regime")
        self.assertEqual(labels["market_regime_model_output"], "Layer 01 · Model Output · Market Regime")
        self.assertEqual(labels["sector_context_features"], "Layer 02 · Features · Sector Context")
        self.assertEqual(labels["sector_context_model_output"], "Layer 02 · Model Output · Sector Context")
        self.assertEqual(labels["target_state_bars_quotes"], "Layer 03 · Source · Target State Bars + Quotes")
        self.assertEqual(labels["target_state_features"], "Layer 03 · Features · Target State")
        self.assertEqual(labels["target_state_model_output"], "Layer 03 · Model Output · Target State")
        self.assertEqual(labels["event_failure_risk_model_output"], "Layer 04 · Model Output · Event Failure Risk")
        self.assertEqual(labels["alpha_confidence_model_output"], "Layer 05 · Model Output · Alpha Confidence")
        self.assertEqual(labels["position_projection_model_output"], "Layer 06 · Model Output · Position Projection")
        self.assertEqual(labels["underlying_action_model_output"], "Layer 07 · Model Output · Underlying Action")
        self.assertEqual(labels["option_expression_model_output"], "Layer 08 · Model Output · Option Expression")
        self.assertEqual(labels["event_risk_governor_events"], "Layer 09 · Source · Event Risk Governor Events")
        self.assertEqual(labels["event_risk_governor_features"], "Layer 09 · Features · Event Risk Governor")
        self.assertEqual(labels["event_risk_governor_model_output"], "Layer 09 · Model Output · Event Risk Governor")

    def test_event_table_puts_event_type_first(self) -> None:
        spec = _TABLE_BY_ID["event_risk_governor_events"]
        self.assertEqual(spec.preferred_columns[0], "event_category_type")
        self.assertEqual(_column_label("event_category_type"), "event_type")

    def test_where_clause_uses_only_known_filter_columns(self) -> None:
        where_sql, params = _where_clause(
            columns=["request_id", "status"],
            search="abc",
            filters={"status": "ready", "unknown": "ignored"},
        )
        self.assertIn('"request_id"::text ILIKE %(search)s', where_sql)
        self.assertIn('"status"::text ILIKE %(filter_0)s', where_sql)
        self.assertNotIn("unknown", where_sql)
        self.assertEqual(params["search"], "%abc%")
        self.assertEqual(params["filter_0"], "%ready%")

    def test_non_empty_column_metadata_omits_all_null_columns_for_visible_rows(self) -> None:
        spec = _TABLE_BY_ID["market_regime_model_output"]
        metadata = [
            {"name": "available_time", "label": "available_time", "data_type": "timestamp"},
            {"name": "empty_score", "label": "empty_score", "data_type": "numeric"},
            {"name": "filled_score", "label": "filled_score", "data_type": "numeric"},
        ]

        visible = _non_empty_column_metadata(_FakeConnection((10, 0, 8)), spec, metadata, "", {}, 10)

        self.assertEqual([column["name"] for column in visible], ["available_time", "filled_score"])

    def test_non_empty_column_metadata_keeps_schema_when_no_rows_match(self) -> None:
        spec = _TABLE_BY_ID["market_regime_model_output"]
        metadata = [
            {"name": "available_time", "label": "available_time", "data_type": "timestamp"},
            {"name": "empty_score", "label": "empty_score", "data_type": "numeric"},
        ]

        visible = _non_empty_column_metadata(_FakeConnection((0, 0)), spec, metadata, "", {}, 0)

        self.assertEqual(visible, metadata)


if __name__ == "__main__":
    unittest.main()
