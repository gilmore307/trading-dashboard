from __future__ import annotations

import unittest

from trading_dashboard.data_tables import _where_clause, table_catalog


class DataTablesTest(unittest.TestCase):
    def test_catalog_exposes_allowlisted_tables(self) -> None:
        table_ids = {row["table_id"] for row in table_catalog()}
        self.assertIn("manager_task_summary", table_ids)
        self.assertIn("manager_requests", table_ids)

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
