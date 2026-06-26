export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | null | '';

export interface DashboardReadModel {
  contract_type: string;
  schema_version: number;
  generated_at_utc: string;
  source_system: string;
  status: string;
  severity?: Severity;
  summary: string;
  chart_payload: HistoricalTaskProgressChartPayload | CurrentSystemStatusChartPayload | RealtimeSignalChartPayload | TemporalExplorerChartPayload | Record<string, unknown> | unknown[];
  profile_refs: unknown[];
  issue_refs: unknown[];
  diagnostic_refs: unknown[];
  lineage_refs: unknown[];
  freshness: {
    class?: string;
    status?: string;
    stale_after_seconds?: number;
    [key: string]: unknown;
  };
  schema_ref: string;
}

export interface TemporalExplorerTickPayload {
  tick_start_utc: string;
  tick_end_utc: string;
  label: string;
  is_center?: boolean;
  market_session_status?: string;
  event_count?: number;
  chart_bar_count?: number;
}

export interface TemporalExplorerLanePayload {
  lane_id: string;
  label: string;
  status: string;
  item_count: number;
}

export interface TemporalExplorerEventPayload {
  event_id: string;
  event_time: string;
  title: string;
  lane: string;
  event_type: string;
  scope?: string | null;
  symbol?: string | null;
  status?: string | null;
  source_priority?: string | null;
  summary?: string | null;
  source_name?: string | null;
  reference_type?: string | null;
  reference?: string | null;
}

export interface TemporalExplorerChartBarPayload {
  symbol: string;
  timeframe: string;
  bucket_start: string;
  bucket_end: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  bar_count?: number;
}

export interface TemporalExplorerChartPayload {
  viewport?: {
    center_time_utc?: string;
    frame?: string;
    available_frames?: string[];
    start_utc?: string;
    end_utc?: string;
  };
  timewheel_ticks?: TemporalExplorerTickPayload[];
  left_lanes?: TemporalExplorerLanePayload[];
  right_lanes?: TemporalExplorerLanePayload[];
  events?: TemporalExplorerEventPayload[];
  counts?: {
    total_events?: number;
    by_lane?: Record<string, number>;
  };
  chart?: {
    symbol?: string;
    timeframe?: string;
    available_symbols?: string[];
    available_timeframes?: string[];
    status?: string;
    bars?: TemporalExplorerChartBarPayload[];
    role?: string;
  };
  substrate_status?: Record<string, { status?: string; row_count?: number; reason?: string }>;
}

export interface StageCoveragePayload {
  stage_id?: string | null;
  status?: string | null;
  unit_label?: string | null;
  expected_count?: number;
  ready_count?: number;
  active_count?: number;
  current_count?: number;
  active_month?: string | null;
  current_month?: string | null;
  active_time_pointer?: string | null;
  pending_count?: number;
  failed_count?: number;
  accepted_failed_count?: number;
  can_unlock_downstream?: boolean;
  progress_source?: string | null;
  progress_basis?: string | null;
  progress_display_basis?: string | null;
  covered_partition_count?: number;
  expected_partition_count?: number;
  updated_at_utc?: string | null;
  worker_id?: string | null;
  nodes?: unknown[];
}

export interface StageExecutionPayload {
  stage_id?: string | null;
  status?: string | null;
  reason?: string | null;
  failure_detail?: string | null;
  return_code?: number | null;
  stdout_path?: string | null;
  stderr_path?: string | null;
  receipt_path?: string | null;
  provider_calls?: number;
  model_activation_performed?: boolean;
  broker_execution_performed?: boolean;
}

export interface CurrentSystemServicePayload {
  unit: string;
  unit_kind?: string;
  unit_type?: string;
  load_state?: string;
  active_state: string;
  enabled_state?: string;
  substate?: string;
  result?: string;
  healthy?: boolean;
}

export interface CurrentSystemSourceOutputPayload {
  label: string;
  kind?: string;
  exists: boolean;
  status: string;
  age_seconds?: number | null;
  latest_updated_at_utc?: string | null;
  freshness_class?: 'heartbeat' | 'event_driven' | string;
  freshness_note?: string | null;
}

export interface CurrentSystemApiPayload {
  name: string;
  kind?: string;
  status: string;
  healthy?: boolean;
  unit?: string;
  service_unit?: string;
  timer_unit?: string;
  latest_updated_at_utc?: string | null;
  age_seconds?: number | null;
}

export interface CurrentSystemParallelismPayload {
  mode?: string;
  selected_worker_count?: number;
  max_worker_count?: number;
  next_request_limit?: number;
  scheduler_interval_seconds?: number;
  scheduler_interval_role?: string;
  drain_ready_stages?: boolean;
  drain_max_steps?: number;
  drain_max_seconds?: number;
  event_refresh_enabled?: boolean;
  event_refresh_service_unit?: string;
  load_target_per_cpu?: number;
  load_1m?: number;
  cpu_count?: number;
  memory_available_mb?: number;
  worker_memory_mb?: number;
  reserved_memory_mb?: number;
  status?: string;
  reason?: string;
}


export interface CurrentSystemRuntimeThroughputPayload {
  status?: string;
  mode?: string;
  month_ingest_worker_count?: number;
  model_worker_count?: number;
  total_worker_count?: number;
  fold_month_count?: number;
  month_ingest_rounds_per_fold?: number | null;
  window_minutes?: number;
  window_start_utc?: string;
  latest_decision_at_utc?: string;
  decision_count?: number;
  executed_decision_count?: number;
  idle_or_blocked_decision_count?: number;
  completion_rate_per_minute?: number;
  max_completions_per_second?: number;
  multi_completion_second_count?: number;
  active_worker_estimate?: number;
  summary?: string;
}

export interface CurrentSystemStatusChartPayload {
  server?: {
    hostname?: string;
    uptime_seconds?: number;
    load_average_1m?: number;
    load_average_5m?: number;
    load_average_15m?: number;
    cpu_usage_percent?: number;
    memory_usage_percent?: number;
    memory_total_mb?: number;
    memory_available_mb?: number;
    network_download_kbps?: number;
    network_upload_kbps?: number;
    storage_total_gb?: number;
    storage_available_gb?: number;
  };
  parallelism?: CurrentSystemParallelismPayload;
  runtime_throughput?: CurrentSystemRuntimeThroughputPayload;
  api?: {
    http_latest_route?: string;
    websocket_latest_route?: string;
    status?: string;
  };
  apis?: CurrentSystemApiPayload[];
  source_connections?: CurrentSystemApiPayload[];
  services?: CurrentSystemServicePayload[];
  source_outputs?: CurrentSystemSourceOutputPayload[];
  refresh?: {
    timer_unit?: string;
    cadence_seconds?: number;
    status?: string;
  };
}

export interface HistoricalTaskWorkerPayload {
  worker_id?: string | null;
  worker_label?: string | null;
  worker_kind?: string | null;
}

export interface HistoricalTaskDatasetUnitPayload {
  unit_kind?: string | null;
  unit_months?: number | null;
  start_month?: string | null;
  end_month?: string | null;
  target_symbol?: string | null;
  target_required?: boolean | null;
  description?: string | null;
}

export interface HistoricalTaskFailureRegisterPayload {
  failure_count?: number;
  agent_review_required_count?: number;
  auto_repair_required_count?: number;
  retry_required_count?: number;
  corrected_count?: number;
  accepted_skip_count?: number;
  status_counts?: Record<string, number>;
  top_errors?: Array<{
    count?: number;
    error_summary?: string | null;
  }>;
  latest_updated_at_utc?: string | null;
}

export interface HistoricalRuntimeActivityPayload {
  activity_type?: string | null;
  activity_label?: string | null;
  activity_summary?: string | null;
  activity_details?: string[];
  progress_label?: string | null;
  progress_hint?: string | null;
  replay_time_pointer?: string | null;
  replay_runtime_trace_ref?: string | null;
  source_missing_count?: number | null;
  source_ready_count?: number | null;
  provider_calls?: number | null;
  batch_index?: number | null;
  batch_size?: number | null;
  batch_count?: number | null;
  option_source_unavailable_count?: number | null;
  started_at_utc?: string | null;
  elapsed_seconds?: number | null;
  updated_at_utc?: string | null;
  required_next_step?: string | null;
  sample_targets?: string[];
}

export interface HistoricalTaskTimelineDetailPayload {
  blockers?: string[];
  receipt_refs?: string[];
  safe_without_provider_calls?: boolean | null;
  provider_calls_allowed?: boolean | null;
  model_activation_allowed?: boolean | null;
  broker_execution_allowed?: boolean | null;
  dataset_unit?: HistoricalTaskDatasetUnitPayload | null;
  progress?: StageCoveragePayload;
  last_execution?: {
    status?: string | null;
    return_code?: number | null;
    reason?: string | null;
  };
  failure_register?: HistoricalTaskFailureRegisterPayload | null;
  agent_error_summary?: AgentErrorSummaryPayload[];
  repair_intervention_status?: string | null;
  worker?: HistoricalTaskWorkerPayload;
  runtime_activity?: HistoricalRuntimeActivityPayload | null;
}

export interface HistoricalTaskTimelineItemPayload {
  sequence: number;
  task_number?: number | null;
  task_uid?: string | null;
  month?: string | null;
  task_id: string;
  task_label: string;
  task_state: 'completed' | 'current' | 'future' | 'failed' | 'skipped' | string;
  status: string;
  stage_type?: string | null;
  layer?: number | null;
  layer_key?: string | null;
  dataset_unit_kind?: string | null;
  dataset_unit_months?: number | null;
  target_symbol?: string | null;
  target_required?: boolean | null;
  worker_id?: string | null;
  worker_label?: string | null;
  worker_kind?: string | null;
  updated_at_utc?: string | null;
  created_at_utc?: string | null;
  started_at_utc?: string | null;
  ended_at_utc?: string | null;
  status_updated_at_utc?: string | null;
  reason?: string | null;
  receipt_count?: number;
  blocker_count?: number;
  detail?: HistoricalTaskTimelineDetailPayload;
}

export interface HistoricalRuntimeActiveWorkPayload {
  month?: string | null;
  stage_id?: string | null;
  status?: string | null;
  decision_status?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  next_internal_stage?: string | null;
  lock_status?: string | null;
  runtime_activity?: HistoricalRuntimeActivityPayload | null;
}

export interface HistoricalTaskProgressChartPayload {
  current_month?: string | null;
  active_stage?: string | null;
  active_task?: HistoricalTaskTimelineItemPayload | null;
  runtime_active_work?: HistoricalRuntimeActiveWorkPayload | null;
  internal_current_month?: string | null;
  internal_active_stage?: string | null;
  progress_percent?: number;
  stage_counts?: Record<string, number>;
  terminal_complete?: boolean;
  service_runtime_ready?: boolean;
  lock_status?: string;
  provider_status?: string;
  next_expected_system_action?: string | null;
  blocker_category?: string | null;
  stage_coverage?: StageCoveragePayload;
  last_stage_execution?: StageExecutionPayload;
  task_timeline?: HistoricalTaskTimelineItemPayload[];
  agent_error_summary?: AgentErrorSummaryPayload[];
}

export interface ModelVersionSummaryPayload {
  version_id?: string | null;
  model_version?: string | null;
  run_id?: string | null;
  artifact_ref?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  promotion_status?: string | null;
  evaluation_status?: string | null;
  created_at_utc?: string | null;
  updated_at_utc?: string | null;
  metrics?: Record<string, unknown>;
  blockers?: string[];
  summary?: string | null;
  [key: string]: unknown;
}

export interface ModelLayerLifecyclePayload {
  layer?: number | null;
  layer_id?: string | null;
  layer_key?: string | null;
  model_id?: string | null;
  model_key?: string | null;
  name?: string | null;
  model_name?: string | null;
  status?: string | null;
  lifecycle_status?: string | null;
  current_version_ref?: string | null;
  latest_version_ref?: string | null;
  active_version_ref?: string | null;
  shadow_version_refs?: string[];
  retiring_version_refs?: string[];
  eliminated_version_refs?: string[];
  versions?: ModelVersionSummaryPayload[];
  evaluation?: Record<string, unknown> | null;
  promotion?: Record<string, unknown> | null;
  blockers?: string[];
  latest_updated_at_utc?: string | null;
  updated_at_utc?: string | null;
  summary?: string | null;
  [key: string]: unknown;
}

export interface ModelLayerReadinessChartPayload {
  layers?: ModelLayerLifecyclePayload[];
  current_layer?: number | null;
  active_model_ref?: string | null;
  shadow_model_refs?: string[];
  retiring_model_refs?: string[];
  eliminated_model_refs?: string[];
  [key: string]: unknown;
}

export interface ModelPromotionItemPayload {
  layer?: number | null;
  layer_id?: string | null;
  layer_key?: string | null;
  model_id?: string | null;
  model_key?: string | null;
  model_ref?: string | null;
  version_id?: string | null;
  promotion_status?: string | null;
  activation_status?: string | null;
  evaluation_status?: string | null;
  latest_agent_decision_status?: string | null;
  missing_evidence_categories?: string[];
  blockers?: string[];
  latest_updated_at_utc?: string | null;
  updated_at_utc?: string | null;
  summary?: string | null;
  [key: string]: unknown;
}

export interface ModelGroupPromotionVersionPayload {
  version_id?: string | null;
  version_label?: string | null;
  promotion_run_id?: string | null;
  fold_id?: string | null;
  target_symbol?: string | null;
  candidate_model_ref?: string | null;
  identity?: string | null;
  decision_status?: string | null;
  agent_review_recommendation?: string | null;
  created_at_utc?: string | null;
  updated_at_utc?: string | null;
  metrics?: Record<string, unknown>;
  blocking_issues?: string[];
  summary?: string | null;
  refs?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ModelPromotionPostureChartPayload {
  models?: ModelPromotionItemPayload[];
  promotions?: ModelPromotionItemPayload[];
  items?: ModelPromotionItemPayload[];
  group_versions?: ModelGroupPromotionVersionPayload[];
  excluded_group_versions?: Array<Record<string, unknown>>;
  status_counts?: Record<string, number>;
  identity_counts?: Record<string, number>;
  [key: string]: unknown;
}

export interface ExecutionRuntimeStatusChartPayload {
  active_model_pointer?: {
    active_model_pointer_status?: string | null;
    selected_active_model_ref?: unknown;
    new_active_config_ref?: unknown;
    active_model_config_present?: boolean;
    [key: string]: unknown;
  };
  runtime_status?: string | null;
  next_gate?: string | null;
  [key: string]: unknown;
}

export interface RealtimeSignalCardPayload {
  label?: string;
  value?: string | number | boolean | null;
  status?: string | null;
  hint?: string | null;
}

export interface RealtimeSignalChartPayload {
  mode?: string | null;
  monitor?: {
    status?: string | null;
    latest_receipt_path?: string | null;
    latest_updated_at_utc?: string | null;
    age_seconds?: number | null;
    cycle_count?: number;
    failed_cycle_count?: number;
  };
  readiness?: {
    feature_snapshot_readiness?: string | null;
    decision_input_readiness?: string | null;
  };
  safety?: {
    provider_calls_performed?: number;
    broker_calls_performed?: number;
    model_activation_performed?: boolean;
    broker_order_construction_performed?: boolean;
    account_mutation_performed?: boolean;
  };
  signal_cards?: RealtimeSignalCardPayload[];
  gaps?: string[];
}

export interface AgentErrorSummaryPayload {
  error_ref?: string | null;
  error_number?: number | null;
  error_kind?: string | null;
  error_scope?: string | null;
  source_component?: string | null;
  source_repo?: string | null;
  summary?: string | null;
  occurred_at_utc?: string | null;
  created_at_utc?: string | null;
  severity?: string | null;
  dashboard_severity?: string | null;
  diagnosis_status?: string | null;
  runner_command?: string | null;
  discord_notification?: unknown;
  repair_status?: string | null;
  handling_status?: string | null;
  retry_recommendation?: string | null;
  root_cause?: unknown;
  files_changed?: string[];
  request_path?: string | null;
  diagnosis_path?: string | null;
}
