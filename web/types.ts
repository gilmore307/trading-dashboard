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

export interface CurrentSystemServicePayload {
  unit: string;
  active_state: string;
  enabled_state?: string;
  substate?: string;
  healthy?: boolean;
}

export interface CurrentSystemSourceOutputPayload {
  label: string;
  kind?: string;
  exists: boolean;
  status: string;
  age_seconds?: number | null;
  latest_updated_at_utc?: string | null;
}

export interface CurrentSystemApiPayload {
  name: string;
  kind?: string;
  status: string;
  healthy?: boolean;
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
}
