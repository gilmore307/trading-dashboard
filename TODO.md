# TODO

## Initial bootstrap

- [x] create local clone / initialize repo structure for `trading-report`
- [x] establish canonical README / docs / TODO bootstrap
- [x] register project in workspace memory routing
- [x] register repo in autosync watcher configuration
- [x] perform initial manual push to GitHub
- [x] define first-wave upstream intake contract for:
  - `trading-manager`
  - `trading-execution`
  - `trading-model`
  - `trading-strategy`
  - `trading-data`
- [x] identify current repo-local report/export logic that should migrate here
- [x] define first unified report bundle schema
- [x] define first dashboard-facing export contract
- [x] document first-pass upstream source inventory
- [x] document first report taxonomy
- [x] document report id / window / provenance rules
- [x] document repo-by-repo migration plan
- [ ] define first concrete execution-review report example bundle
- [ ] define first concrete workflow report example bundle

## Migration direction

- [ ] move final report assembly out of upstream repos over time
- [ ] keep upstream repos focused on domain outputs/manifests, not final report formatting
- [ ] preserve or improve machine-readable upstream producer outputs during migration
- [x] ensure every report bundle records upstream provenance

## Scope rule

`trading-report` should own:
- report intake contracts
- output normalization for reporting
- cross-repo report assembly
- final report bundles
- dashboard-facing report exports
- provenance/lineage metadata for reports

`trading-report` should not own:
- upstream data acquisition
- strategy simulation internals
- model-training internals
- live execution internals
- cross-repo workflow scheduling
- dashboard rendering/presentation logic itself
