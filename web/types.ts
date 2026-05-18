export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | null | '';

export interface DashboardReadModel {
  contract_type: string;
  schema_version: number;
  generated_at_utc: string;
  source_system: string;
  status: string;
  severity?: Severity;
  summary: string;
  chart_payload: HistoricalTaskProgressChartPayload | CurrentSystemStatusChartPayload | Record<string, unknown> | unknown[];
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

export interface StageCoveragePayload {
  stage_id?: string | null;
  status?: string | null;
  expected_count?: number;
  ready_count?: number;
  pending_count?: number;
  failed_count?: number;
  accepted_failed_count?: number;
  can_unlock_downstream?: boolean;
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
  worker?: HistoricalTaskWorkerPayload;
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

export interface HistoricalTaskProgressChartPayload {
  current_month?: string | null;
  active_stage?: string | null;
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
  repair_status?: string | null;
  handling_status?: string | null;
  retry_recommendation?: string | null;
  root_cause?: string | null;
  files_changed?: string[];
  request_path?: string | null;
  diagnosis_path?: string | null;
}
