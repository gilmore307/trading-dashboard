# 03 Report schema and bundle layout

## Goal

Define one shared report contract that downstream visualization can trust.

## First-pass bundle structure

Proposed report bundle layout:

- `reports/<report_type>/<report_id>/report.json`
- `reports/<report_type>/<report_id>/summary.md`
- `reports/<report_type>/<report_id>/sources.json`
- `reports/<report_type>/<report_id>/exports/`

## First-pass schema sections

A report bundle should be able to carry:
- `meta`
  - report id
  - report type
  - generated at
  - reporting window
  - schema version
- `sources`
  - upstream repo name
  - upstream artifact path
  - run id / manifest id when available
  - content hash or version marker when available
- `status`
  - completeness
  - missing upstream inputs
  - stale input warnings
- `summary`
  - executive bullets
  - key metrics
  - key decisions / notable changes
- `sections`
  - repo-specific or cross-repo sections rendered from normalized inputs
- `dashboard_exports`
  - dashboard-facing flat/normalized payloads

## Provenance rule

Every final report should preserve enough source metadata to answer:
- which upstream repos contributed
- which files/manifests were used
- whether inputs were complete
- whether the report is reproducible later

## Migration rule

If an upstream repo already has useful local report markdown/json generation logic, that logic should be treated as migration material.
The steady-state target is still to move the canonical final assembly into `trading-report`.
