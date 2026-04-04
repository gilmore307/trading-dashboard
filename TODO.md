# TODO

## Initial bootstrap

- [x] create local clone / initialize repo structure for `trading-report`
- [x] establish canonical README / docs / TODO bootstrap
- [x] register project in workspace memory routing
- [x] register repo in autosync watcher configuration
- [ ] perform initial manual push to GitHub
- [ ] define first-wave upstream intake contract for:
  - `trading-manager`
  - `trading-execution`
  - `trading-model`
  - `trading-strategy`
  - `trading-data`
- [ ] identify current repo-local report/export logic that should migrate here
- [ ] define first unified report bundle schema
- [ ] define first dashboard-facing export contract

## Migration direction

- [ ] move final report assembly out of upstream repos over time
- [ ] keep upstream repos focused on domain outputs/manifests, not final report formatting
- [ ] preserve or improve machine-readable upstream producer outputs during migration
- [ ] ensure every report bundle records upstream provenance

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
