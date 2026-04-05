# 10 Open questions and next doc work

## Open questions

### 1. Canonical report storage path
Should the long-term report bundle root be:
- `reports/<report_type>/<report_id>/`
or
- another partitioned path keyed by symbol/window first?

### 2. Shared schema depth
How much normalization should happen in the first version?
The initial target should be enough consistency for dashboard consumption, not premature perfect universal abstraction.

### 3. Window identity rules
Which report families should be keyed primarily by:
- run id
- month
- upgrade event
- strategy version window
- workflow id

### 4. Summary vs detail split
How much detail should live directly in `report.json` versus separate dashboard exports or linked source references?

### 5. Dashboard contract surface
Should `ops-dashboard` read:
- report bundles directly
- a curated exports directory only
- both, with different purposes?

## Next documentation steps

1. turn the first-pass intake contract into a more concrete source-map table per repo
2. write the first dashboard-facing export shape examples
3. define the first report bundle example for the execution-review family
4. define the first workflow-report example that ties multiple repos together
5. review older upstream docs and trim any language that still implies each repo owns its own final report product forever
