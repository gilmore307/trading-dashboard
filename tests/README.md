# tests

First-party tests for dashboard implementation slices.

## Current coverage

- `test_read_models.py` verifies storage-hosted dashboard read-model loading, UI-ready view projection, unsafe contract rejection, missing latest-file behavior, and the read-only CLI path.
- `test_data_tables.py` verifies the allowlisted read-only source, feature, and model-output table catalog plus query helper filtering behavior.

## Default command

```bash
python3 -m compileall -q src scripts tests
PYTHONPATH=src python3 -m unittest discover -s tests
```
