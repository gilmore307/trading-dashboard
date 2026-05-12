# tests

First-party tests for dashboard implementation slices.

## Current coverage

- `test_read_models.py` verifies storage-hosted dashboard read-model loading, UI-ready view projection, unsafe contract rejection, missing latest-file behavior, and the read-only CLI path.

## Default command

```bash
PYTHONPATH=src python3 -m unittest discover -s tests
```
