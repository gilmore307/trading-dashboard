# Dashboard Information Architecture

## Purpose

The dashboard is a concise owner-facing summary surface for understanding system posture, model posture, realtime signal posture, and trading performance.

It is not an internal maintenance console, artifact explorer, registry editor, or workflow-control surface. A curated registry dictionary is allowed as an explanation surface for accepted system vocabulary.

## Design Principles

- Charts first, text second.
- Summaries first, drilldowns only when they explain a user-facing issue.
- Owner-facing status, not internal implementation noise.
- Read-only presentation by default.
- Every displayed metric should have a clear source and human-readable explanation.
- Registry-backed field profiles should explain visible dashboard fields in context. A curated registry dictionary may also exist for search/reference, but it must stay explanatory rather than operational.

## Primary Navigation

The left sidebar is grouped by user intent:

- General — Status, Definitions, and Diagnostics.
- Historical Models — Tasks, Data, Model Groups, Replay Performance, Replay Decisions, Replay Operations, and Replay Attribution.
- Realtime — Realtime Signals.

## Page Contracts

### Status

Purpose: answer “Is the system healthy enough for its current role?”

Visible content should include:

- high-level server/resource health;
- API/provider reachability and freshness where relevant;
- key system service state;
- historical scheduler / realtime monitor status at summary level;
- current blockers that affect modeling, signals, or trading visibility;
- alert summary by severity and unresolved count;
- safety-gate posture only when it affects user-facing readiness.

Preferred visuals:

- service health cards;
- uptime/freshness timelines;
- resource trend charts;
- provider/API status matrix;
- alert/event timeline.

Hidden by default:

- raw systemd logs;
- lock files;
- detailed daemon internals;
- request/run/artifact row dumps;
- maintenance-only checks unless they affect user-facing readiness.

### Definitions

Purpose: answer “What does this system term, field, status, contract, or script name mean?”

Visible content should include:

- searchable accepted registry vocabulary;
- concise term/field/contract/status explanations;
- source repository and canonical path where useful;
- accepted value ranges or status vocabularies;
- last-updated metadata when useful;
- links back to pages where the term appears.

Preferred visuals:

- search-first dictionary layout;
- kind filters;
- related-term graph for high-value concepts;
- compact profile cards.

Hidden by default:

- registry maintenance/migration internals;
- raw SQL migration history;
- editor controls;
- rows irrelevant to visible dashboard concepts unless searched explicitly.

Definitions is read-only and explanatory. It must not become the canonical registry editor or a replacement for `trading-manager` registry governance.

### Diagnostics

Purpose: answer “What visible system errors or degraded states need attention?”

Visible content should include:

- active unresolved diagnostics;
- severity and affected area;
- first-seen / last-seen / age;
- concise cause category;
- whether the issue blocks modeling, realtime signals, or trading performance visibility.

Preferred visuals:

- severity filters;
- compact error/status table;
- blocker impact summary.

Hidden by default:

- raw logs;
- stack traces;
- internal receipt dumps;
- low-level daemon details.

Diagnostic details may be reachable only when they explain a visible status, task, model, replay, signal, or performance issue.

### Tasks

Purpose: answer “What important work is underway, complete, blocked, or waiting?”

Visible content should include:

- historical stage/month/layer progress at summary level;
- current active task;
- completion percentage and blocker category;
- failures that need attention;
- next expected system action.

Preferred visuals:

- progress matrix;
- Gantt-style or timeline view;
- blocker summary cards;
- ready/pending/failed stacked bars.

Hidden by default:

- individual manager request payloads;
- run manifests;
- artifact refs;
- ready-signal rows;
- low-level receipt details.

Those internals may be reachable only through an advanced diagnostic drawer when a visible task is failed or blocked.

### Data

Purpose: answer “What approved source, feature, and model-output tables are available for read-only inspection?”

Visible content should include:

- allowlisted source, feature, and main model-output tables;
- table selection, search, filtering, sorting, and pagination;
- source artifact write time versus dashboard read-model refresh time where relevant.

Hidden by default:

- arbitrary SQL;
- manager control-plane tables;
- dataset and promotion internals;
- diagnostics internals.

### Model Groups

Purpose: answer “Is this model group statistically and structurally credible as machine learning, and how are model-group versions evolving?”

Subpages:

- 0 — Model Group Versions
- M01 — Market Regime
- M02 — Sector Context
- M02 — Target State Vector
- M03 event-state — Event Failure Risk
- M04 decision — Alpha Confidence
- M04 risk — Dynamic Risk Policy
- M04 decision — Position Projection
- M04 decision — Underlying Action
- M05 — Trading Guidance / Option Expression
- M06 — Event Risk Governor / Event Intelligence Overlay

The model-group page owns:

- all published model-group promotion versions;
- active/shadow/retired/candidate identity by version;
- machine-learning validity metrics such as AUROC, PR-AUC, Brier, ECE/MCE, calibration/reliability, confusion or threshold-quality evidence, uncertainty, and temporal stability when published;
- feature-space and representation diagnostics such as PCA, PCoA, silhouette, cluster separation, feature/parameter importance, ablation, layer attribution, and MBatchNet-style batch/temporal/feature analysis when published;
- promotion decision table rows with fold identity, decision, agent recommendation, and metric values.

Model pages own:

- model family and objective;
- model role in the model group;
- optimization target, loss pressure, and regularization goal;
- published component versions when available.
- key parameters or configuration summaries;
- model role in the pipeline.

Preferred visuals:

- metric cards;
- model-parameter grids;
- model-validity trend charts;
- confusion/quality summaries where applicable;
- group promotion-readiness checklist;
- group candidate timeline.

Hidden by default:

- feature rows;
- intermediate model artifacts;
- raw evaluation files;
- task statuses and task blockers;
- internal request/control-plane records;
- implementation logs.

### Replay Performance

Purpose: answer “How did the historical replay perform economically?”

Visible content should include:

- normalized replay net-asset-value series with every displayed strategy, ETF, layer, or context comparison rebased to `1.0` at the selected start;
- one replay performance chart slot: single-selection views show the monthly normalized NAV K-line using row-path OHLC when the replay read model publishes it, while multi-selection views switch to normalized NAV lines for readability;
- summary comparison mode when no replay series is selected, selected comparison mode when multiple replay series are selected, and focus mode only when exactly one replay series is selected;
- strategy, ETF, M01, M02, and sector-anchor performance summary rows when those comparison series are published;
- trading performance metrics such as total return, excess return, max drawdown, annualized return, volatility, Sharpe, Sortino, Calmar, beta, and monthly win rate when available;
- replay review performance evidence such as decision rows, fill counts, gross PnL, mean realized return, selected-target counts, replacement benefit, opportunity capture, and regret when `model_group_replay_review_summary` publishes it;
- metric comparison charts for cross-model return and risk statistics when no model group or multiple model groups are selected;
- selected-model diagnostics with detailed return, risk, trade-outcome, decision-scale, replacement, regret, notional, and review-coverage statistics when exactly one model group is selected.

The replay initial capital of `25000 USD` is an execution/risk-limit input. It may appear as metadata, but Performance charts compare normalized values from `1.0` so strategy and ETF/context series share one scale.

Hidden by default:

- component decision traces;
- raw decision rows;
- execution adapter internals;
- broker/account state.

### Replay Operations

Purpose: answer “Did the replay machinery expose, route, compute, and execute the decision correctly?”

Visible content should include:

- the same model-group selector pattern used by Replay Performance and Replay Decisions;
- C01-C07 in-page component tabs: Intake, Entry, Lifecycle, Option Review, Order Intent, Execution Gate, and Failure Review;
- summary mode comparing the active component across replayed model groups;
- focus mode for one selected model group, with the active component's metric cards, time-axis trend charts, summary row, and sample ledger;
- component-specific metric families, analysis methods, evidence roles, required-evidence status, and component verdicts;
- C03 lifecycle continuity and replacement-policy evidence, or an explicit lifecycle evidence gap if the replay review did not publish position-state evidence;
- first-gap component and first-gap mechanism evidence from replay review rows.

Preferred visuals:

- component tabs rather than large vertical scrolling;
- hover readouts;
- summary metric cards;
- time-axis line charts in focus mode;
- component comparison bar charts in summary mode;
- inspectable component sample tables.

Hidden by default:

- model statistical validity metrics such as AUROC;
- raw decision rows;
- model-layer decision-quality attribution and score/threshold/cost diagnostics;
- model-layer M01-M05 correctness sections, which belong under Replay Decisions;
- raw provider plumbing;
- dataset internals unless they explain replay gaps.

### Replay Decisions

Purpose: answer “Did each model layer choose reasonably with point-in-time evidence and the available candidate set?”

Visible content should include:

- replay decision-version selector with the same selector format used by the replay page family;
- five separate layer chapters, one each for M01 through M05;
- in macro mode, each layer chapter compares model groups with that layer's summary table, layer-specific analysis method, and charts for the metrics that match that layer's role;
- in focused mode, each layer chapter shows that model group's layer cards, charts, summary table, and effective decision ledger;
- per-layer method context: M01 context-state diagnostics, M02 target selection/rank/tradability, M03 event pressure, M04 underlying action labels, and M05 option-expression/contract-path labels;
- effective layer-decision ledger rows with timestamp, target, scoring status, correctness class, acceptability class, regret, impact, cause family, failure type, chosen decision, best-available post-replay label, and candidate scope;
- current review runs publish one scored M01-M05 layer row per replay decision per layer; `effective_trace_unscored` is retained only as a legacy fallback for older artifacts without dedicated layer review rows;
- explicit exclusion of M06 residual-event governance from the layer-decision correctness scope;
- clear separation between point-in-time decision evidence and future-return/counterfactual labels.

Hidden by default:

- normalized NAV and professional performance metrics, which belong under Replay Performance;
- replay source-data readiness, component health, and execution graph diagnostics, which belong under Replay Operations;
- model statistical validity metrics such as AUROC unless they are needed as local context for a decision failure;
- score-decile return, threshold-return, cost-sensitivity, and decision-slice diagnostics as primary content because they do not answer per-layer replay correctness.

### Replay Attribution

Purpose: answer “Which replay errors occurred, where were they attributed in the replay/model stack, and are any of them linked to event evidence?”

Visible content should include:

- replay error attribution counts by cause family, failure type, miss-attribution layer, and first-gap component;
- replay error sample rows with model group, decision time, target, layer, cause, failure, gap, regret, and event-link status;
- event-linkage readiness that clearly separates "event refs published" from "no event refs published";
- event-candidate counts only when replay review rows publish them.

Preferred visuals:

- attribution distribution charts;
- event-link readiness cards;
- dense replay error sample table;
- future event-linked error timelines after review rows publish event refs.

Hidden by default:

- raw event payloads unless needed for a focused replay-error explanation;
- event promotion or pool mutation controls;
- event-timeline exploration that is not tied to replay error attribution.

### Realtime Signals

Purpose: answer “What is being monitored now, and what signals are present?”

Visible content should include:

- monitor mode/state;
- completed and failed cycle counts;
- provider observation counts;
- realtime feature snapshot readiness;
- model decision-input readiness;
- safety-boundary flags;
- visible gaps, including `not_started` when no monitor receipt exists.

Hidden by default:

- live feed plumbing;
- adapter internals;
- capture fixtures;
- raw stream events unless needed for a visible incident.

### Trading Performance

Purpose: answer “How is realtime trading performing?”

This tab is parked until realtime trading is active and stable enough to summarize.

Future visible content should include:

- PnL and drawdown;
- exposure;
- win/loss and expectancy;
- slippage/fill quality;
- model decision vs realized outcome attribution;
- risk and capital usage.

Hidden by default:

- broker adapter internals;
- raw fills unless needed for explanation;
- reconciliation implementation details.

## Registry Field Profiles

The dashboard should support contextual field profiles for visible registry-backed fields.

Hover profile content should be concise:

- human-readable label;
- short meaning;
- source system;
- freshness / last updated if relevant;
- accepted value range or status vocabulary where useful;
- link to advanced registry detail when needed.

The registry dictionary may be a primary utility tab, but registry profiles should remain concise and user-facing. Full raw registry rows are secondary details, not the default display.

## Advanced Diagnostics Boundary

Advanced diagnostic drawers may exist, but only to explain a user-facing status, blocker, alert, model issue, signal issue, or performance anomaly.

They should not turn the dashboard into a general maintenance UI. Internal artifacts, manifests, ready signals, request payloads, storage lifecycle receipts, and daemon implementation details stay hidden unless they directly explain a visible owner-facing problem.

## Non-Goals

The dashboard must not:

- initiate provider calls;
- schedule manager work;
- activate models;
- mutate storage lifecycle state;
- construct or submit broker orders;
- expose secrets;
- become the canonical registry editor;
- become the primary internal artifact browser;
- require the owner to understand intermediate artifacts to use the site.
