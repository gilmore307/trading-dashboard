export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | null | '';

export interface DashboardReadModel {
  contract_type: string;
  contract_version: string;
  generated_at_utc: string;
  source_system: string;
  status: string;
  severity?: Severity;
  summary: string;
  chart_payload: HistoricalTaskProgressChartPayload | Record<string, unknown> | unknown[];
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
