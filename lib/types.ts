export type ServingMode = 'distributed' | 'standalone';
export type PerformanceGoal = 'balanced' | 'max_throughput' | 'low_latency' | 'high_availability';
export type ScalePreset = 'small' | 'medium' | 'large' | 'auto';
export type DeploymentStatus = 'healthy' | 'reconciling' | 'degraded' | 'stopped' | 'error';
export type ApplianceState = 'READY' | 'RECONCILING' | 'DEGRADED' | 'BOOT';
export type NodeStatus = 'online' | 'offline' | 'degraded';

export interface GpuDevice {
  index: number;
  name: string;
  vram_mb: number;
  utilization_pct?: number;
  vram_used_mb?: number;
}

export interface NodeConfig {
  id: string;
  hostname: string;
  ip: string;
  is_head: boolean;
  gpus_reserved_for_system: number;
  labels: string[];
  status: NodeStatus;
  gpus: GpuDevice[];
}

export type ComputeBackend = 'federation' | 'cluster';
export type FederationLayout = 'replicated' | 'diverse';

export interface ClusterConfig {
  serving_mode: ServingMode;
  compute_backend?: ComputeBackend;
  federation_layout?: FederationLayout;
  head_gpu?: boolean;
  head_node_id: string;
  head_epoch: number;
  global_defaults: {
    autoscale_enabled: boolean;
  };
}

export type ModelSource =
  | { type: 'huggingface'; repo_id: string; hf_token?: string }
  | { type: 'local_path'; path: string };

export interface AutoscalingConfig {
  min_instances: number;
  max_instances: number;
  target_ongoing_requests: number;
}

export interface DeploymentParallelism {
  context_length: number;
  quantization: string | null;
  instances: number;
  gpus_per_instance: number;
  nodes_per_instance: number;
  gpu_utilization?: number;
  autoscaling: AutoscalingConfig | null;
}

export interface DeploymentPlacementTarget {
  node_id: string;
  gpu_indices: number[];
}

export type PlacementMode = 'auto' | 'manual';

export interface DeploymentPlacement {
  mode?: PlacementMode;
  targets?: DeploymentPlacementTarget[];
}

/** chat = completions; embedding = GPU /v1/embeddings for RAG */
export type DeploymentRole = 'chat' | 'embedding';

export interface CapabilityPack {
  id: string;
  description: string;
  enabled: boolean;
  pack: string;
  pack_version: string;
  mcp_server: string;
  allowed_tools: string[];
  docs: string;
  health: { status: string; detail?: string };
  configured: boolean;
  configured_detail: string;
  read_only: boolean;
  access_modes?: string[];
  tenant_id?: string;
  access_mode?: 'ro' | 'rw';
  grant_enabled?: boolean;
  requires_hitl?: boolean;
  rw_blocked_reason?: string | null;
}

export interface CapabilitiesResponse {
  mcp_enabled: boolean;
  tenant_id?: string;
  allow_rw_capabilities?: boolean;
  capabilities: CapabilityPack[];
}

export interface RagConfig {
  version: string;
  tenant_id: string;
  embedding_model_id: string;
  embedding_dim: number;
  chunker_version: string;
  default_corpus_id: string;
  hybrid_default: boolean;
}

export interface PlatformSnapshot {
  tenant_id: string;
  rag: RagConfig;
  prompts: Array<{
    id: string;
    version: string;
    title: string;
    body: string;
    tenant_id: string;
    tags: string[];
  }>;
  acl: {
    version: string;
    tenant_id: string;
    group_capabilities: Record<string, string[]>;
    rw_admin_roles: string[];
    sso_enabled: boolean;
    notes: string;
  };
  grants: Array<{
    capability_id: string;
    access_mode: 'ro' | 'rw';
    enabled: boolean;
    requires_hitl: boolean;
    granted_by?: string | null;
    granted_at?: string | null;
    ack_message?: string | null;
  }>;
  allow_rw_capabilities: boolean;
  agent_runtime: string;
  versions: Array<{
    id: number;
    kind: string;
    version: string;
    payload: unknown;
    created_at: string;
    created_by?: string | null;
  }>;
}

export interface DeploymentConfig {
  id: string;
  display_name: string;
  enabled: boolean;
  /** Defaults to chat when omitted (backward compatible). */
  role?: DeploymentRole;
  source: ModelSource;
  user_intent: {
    performance_goal: PerformanceGoal;
    scale: ScalePreset;
  };
  parallelism: DeploymentParallelism;
  placement?: DeploymentPlacement;
  status: DeploymentStatus;
}

export type OrchestrationConfig = ClusterConfig & {
  federation_auto_placement?: boolean;
};

export type OrchestrationPutResponse = OrchestrationConfig & {
  reconcile_seq?: number | null;
};

export interface SystemConfig {
  network: {
    head_ip: string;
    gateway: string;
    dns: string[];
  };
  time: {
    ntp_servers: string[];
  };
  security: {
    api_token_set: boolean;
  };
}

export interface StorageMount {
  id: string;
  type: 'nfs' | 'smb' | 's3';
  remote: string;
  local_path: string;
}

export interface StorageConfig {
  mounts: StorageMount[];
}

export interface ApplianceConfig {
  version: 2;
  appliance_id: string;
  cluster: ClusterConfig;
  nodes: NodeConfig[];
  deployments: DeploymentConfig[];
  system: SystemConfig;
  storage: StorageConfig;
}

export interface ReconcileEvent {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  event?: string;
  reconcile_seq?: number;
}

export interface HeadChangedPayload {
  head_node_id: string;
  head_ip: string;
  head_epoch: number;
}

export interface ActualRuntimeStatus {
  health?: string;
  exit_code?: number | null;
  log_snippet?: string | null;
  current_model?: string | null;
}

export interface ApplianceStatus {
  state: ApplianceState;
  last_error: string | null;
  last_reconcile_ts: number;
  events: ReconcileEvent[];
  head: HeadChangedPayload;
  download_progress?: {
    bytes: number;
    file: string;
  };
  actual?: ActualRuntimeStatus;
}

export interface ClusterInventory {
  total_gpu_count: number;
  available_gpu_count: number;
  max_gpus_per_node: number;
  online_node_count: number;
  head_online: boolean;
}

export type AgentPhase = 'idle' | 'running' | 'degraded';

export interface NodeAgentState {
  node_id: string;
  last_seen: number;
  heartbeat_ts: number;
  agent_phase: AgentPhase;
  /** Head coordinator this agent sends heartbeats to */
  head_target_node_id: string;
}

export interface GatewayInfo {
  local_node_id: string;
  is_head: boolean;
  head_api_url: string;
}

export interface MockState {
  config: ApplianceConfig;
  status: ApplianceStatus;
  /** Simulates which node this gateway instance runs on */
  local_node_id: string;
  agents: Record<string, NodeAgentState>;
  storage_usage: {
    total_bytes: number;
    used_bytes: number;
    paths: Record<string, { name: string; size_bytes: number; type: 'dir' | 'file' }[]>;
  };
}

export interface PlannerRecommendation {
  instances: number;
  gpus_per_instance: number;
  nodes_per_instance: number;
  context_length: number;
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggested?: PlannerRecommendation;
  inventory?: ClusterInventory;
}

export interface MigrateHeadResult {
  success: boolean;
  error?: string;
  head: HeadChangedPayload;
  impact: {
    from_node_id: string;
    to_node_id: string;
    deployments_rescheduled: number;
  };
}