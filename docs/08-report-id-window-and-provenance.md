# 08 Report id, window, and provenance

This document defines identity/provenance rules for unified reports.

## Report identity rule

A report should be uniquely identifiable without guessing from directory names alone.

Minimum identity fields:
- `report_id`
- `report_type`
- `schema_version`
- `generated_at`

## Window rule

Every report should declare its reporting window explicitly.

Recommended window fields:
- `window_type`
- `window_start`
- `window_end`
- `window_label`
- `business_timezone`

Examples of `window_type`:
- `event`
- `day`
- `week`
- `month`
- `run`
- `upgrade_boundary`

## Provenance rule

Every report bundle should preserve enough source lineage to answer:
- which upstream repos contributed
- which artifacts/manifests/signals were used
- which producer versions or mappings were active
- whether any expected upstream inputs were missing

## Source entry shape

Each source entry should ideally carry:
- `source_repo`
- `artifact_type`
- `artifact_path`
- `artifact_window`
- `artifact_generated_at`
- `producer_run_id` when available
- `version_marker` when available
- `ingest_note` when needed

## Missing-input rule

Missing sources should be recorded explicitly, not silently ignored.

Recommended status fields:
- `complete`
- `missing_required_sources`
- `missing_optional_sources`
- `stale_sources`
- `warnings`

## Reproducibility rule

A future operator should be able to reconstruct why a report looked the way it did from:
- the report bundle itself
- its source entries
- the upstream artifact contracts
