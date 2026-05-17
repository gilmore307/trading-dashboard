from __future__ import annotations

import unittest

from trading_dashboard.data_tables import _TABLE_BY_ID, _column_label, table_catalog, _where_clause


class DataTablesTest(unittest.TestCase):
    def test_catalog_exposes_allowlisted_downloaded_data_tables(self) -> None:
        table_ids = {row["table_id"] for row in table_catalog()}
        self.assertIn("market_regime_bars", table_ids)
        self.assertIn("target_state_bars_quotes", table_ids)
        self.assertIn("event_risk_governor_events", table_ids)
        self.assertNotIn("manager_requests", table_ids)

    def test_catalog_orders_tables_by_layer_then_surface(self) -> None:
        table_ids = [row["table_id"] for row in table_catalog()]
        self.assertEqual(
            table_ids,
            [
                "market_regime_bars",
                "market_regime_features",
                "sector_context_features",
                "target_state_bars_quotes",
                "target_state_features",
                "event_risk_governor_events",
                "event_risk_governor_features",
            ],
        )

    def test_catalog_labels_layer_owned_tables_with_layer_and_flow_prefixes(self) -> None:
        labels = {row["table_id"]: row["label"] for row in table_catalog()}
        self.assertEqual(labels["market_regime_bars"], "Layer 01 · Source · Market Regime Bars")
        self.assertEqual(labels["market_regime_features"], "Layer 01 · Features · Market Regime")
        self.assertEqual(labels["sector_context_features"], "Layer 02 · Features · Sector Context")
        self.assertEqual(labels["target_state_bars_quotes"], "Layer 03 · Source · Target State Bars + Quotes")
        self.assertEqual(labels["target_state_features"], "Layer 03 · Features · Target State")
        self.assertEqual(labels["event_risk_governor_events"], "Layer 09 · Source · Event Risk Governor Events")
        self.assertEqual(labels["event_risk_governor_features"], "Layer 09 · Features · Event Risk Governor")

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


if __name__ == "__main__":
    unittest.main()
