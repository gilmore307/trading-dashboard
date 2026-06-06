#!/usr/bin/env python3
"""Read a storage-hosted dashboard read-model current file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from trading_dashboard.read_models import DEFAULT_STORAGE_ROOT, read_dashboard_read_model_latest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read one storage-hosted dashboard read-model current file.")
    parser.add_argument("contract_type")
    parser.add_argument("--storage-root", type=Path, default=DEFAULT_STORAGE_ROOT)
    args = parser.parse_args(argv)

    view = read_dashboard_read_model_latest(args.contract_type, storage_root=args.storage_root)
    sys.stdout.write(json.dumps(view.as_dict(), indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
