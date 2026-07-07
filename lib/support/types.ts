export type SupportVerdict =
  | 'likely_bug'
  | 'operator_actionable'
  | 'insufficient_data'
  | 'unknown';

export type DiagnosticBundle = {
  bundle_version: 1;
  appliance_id: string;
  submitted_at: string;
  software: {
    console_version: string;
    controller_version: string;
    support_client_version: string;
  };
  topology: {
    serving_mode: string;
    role: string;
    node_count: number;
    local_node_id: string;
  };
  health: {
    state: string;
    last_error: string | null;
    actual?: {
      health?: string;
      exit_code?: number | null;
      log_snippet?: string | null;
      current_model?: string | null;
    };
  };
  events: Array<{
    id: string;
    timestamp: string;
    message: string;
    level: string;
    event?: string;
    reconcile_seq?: number;
  }>;
  deployments_summary: Array<{
    id: string;
    display_name: string;
    enabled: boolean;
    status: string;
  }>;
  nodes_summary: Array<{
    id: string;
    hostname: string;
    status: string;
    is_head: boolean;
    gpu_count: number;
  }>;
  user_note?: string;
  attachments?: Record<string, unknown>;
};

export type DiagnosisResult = {
  verdict: SupportVerdict;
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  recommended_actions: string[];
  engineering_notes?: string;
  evidence?: string[];
};

export type EntitlementResponse = {
  entitled: boolean;
  tier?: string | null;
  message?: string | null;
};

export type TicketCreateResponse = {
  ticket_id: string;
  status: string;
};

export type TicketStatusResponse = {
  ticket_id: string;
  status: string;
  diagnosis?: DiagnosisResult;
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  github_issue_url?: string | null;
};

export type TicketSummary = {
  ticket_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  verdict?: SupportVerdict | null;
  summary?: string | null;
  confidence?: DiagnosisResult['confidence'] | null;
  github_issue_url?: string | null;
};

export type TicketListResponse = {
  appliance_id: string;
  tickets: TicketSummary[];
};

export type SupportDiagnostics = {
  version: string;
  appliance_id: string;
  controller_logs_tail?: string;
  container_logs_tail?: Record<string, string>;
  reconcile_log_tail?: Array<{
    id: string;
    timestamp: string;
    message: string;
    level: string;
    event?: string;
    reconcile_seq?: number;
  }>;
  host?: {
    disk?: { total_bytes: number; used_bytes: number; free_bytes: number };
    gpu?: {
      available: boolean;
      device_count: number;
      devices: Array<{
        index: number;
        name: string;
        total_vram_mb: number;
        free_vram_mb: number;
      }>;
      error?: string | null;
    };
    nvidia_driver_version?: string | null;
  };
};