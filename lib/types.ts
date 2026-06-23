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

export interface ClusterConfig {
  serving_mode: ServingMode;
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
  autoscaling: AutoscalingConfig | null;
}

export interface DeploymentConfig {
  id: string;
  display_name: string;
  enabled: boolean;
  source: ModelSource;
  user_intent: {
    performance_goal: PerformanceGoal;
    scale: ScalePreset;
  };
  parallelism: DeploymentParallelism;
  status: DeploymentStatus;
}

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
}

export interface HeadChangedPayload {
  head_node_id: string;
  head_ip: string;
  head_epoch: number;
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