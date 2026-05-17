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

    def test_catalog_labels_layer_owned_tables_with_layer_prefixes(self) -> None:
        labels = {row["table_id"]: row["label"] for row in table_catalog()}
        self.assertTrue(labels["market_regime_bars"].startswith("Layer 01 · "))
        self.assertTrue(labels["sector_context_features"].startswith("Layer 02 · "))
        self.assertTrue(labels["target_state_bars_quotes"].startswith("Layer 03 · "))
        self.assertTrue(labels["event_risk_governor_events"].startswith("Layer 09 · "))

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
