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

### 1. Status

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

### 2. Alerts and Exceptions

Purpose: answer “What needs attention, and what should I look at first?”

Visible content should include:

- active unresolved alerts;
- severity and affected area;
- first-seen / last-seen / age;
- concise cause category;
- suggested owner/system next action;
- whether the issue blocks modeling, realtime signals, or trading performance visibility.

Preferred visuals:

- severity cards;
- alert timeline;
- affected-system heatmap;
- open/resolved trend chart;
- blocker impact matrix.

Hidden by default:

- raw logs;
- stack traces;
- internal receipt dumps;
- low-level daemon details.

Diagnostic details may be reachable only from a specific alert when they help resolve that alert.

### 3. Tasks

Purpose: answer “What important work is underway, complete, blocked, or waiting?”

Subtabs:

- Historical Modeling
- Realtime Trading

Visible content should include:

- stage/month/layer progress at summary level;
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

### 4. Models

Purpose: answer “What model group is eligible for live/shadow use, what evaluation and promotion evidence supports that posture, and what does each layer model actually do?”

Subpages:

- 0 — Model Group Pipeline
- Layer 1 — Market Regime
- Layer 2 — Sector Context
- Layer 3 — Target State Vector
- Layer 4 — Event Failure Risk
- Layer 5 — Alpha Confidence
- Layer 6 — Dynamic Risk Policy
- Layer 7 — Position Projection
- Layer 8 — Underlying Action
- Layer 9 — Trading Guidance / Option Expression
- Layer 10 — Event Risk Governor / Event Intelligence Overlay

The model-group page owns:

- group evaluation metrics such as AUROC when published at group scope;
- promotion status, promotion rate, and promotion blockers;
- active live pointer;
- shadow, retiring, and eliminated candidate counts;
- group candidate refs and update times.

Layer pages own:

- model family and objective;
- input scope and output surface;
- score boundary and training window;
- latest candidate ref and update time;
- key parameters or configuration summaries;
- layer role in the pipeline.

Preferred visuals:

- metric cards;
- model-parameter grids;
- group performance trend charts;
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

### 5. Realtime Trading Signals

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

### 6. Trading Performance Summary

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

### 7. Registry Dictionary

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

The registry dictionary is read-only and explanatory. It must not become the canonical registry editor or a replacement for `trading-manager` registry governance.

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
