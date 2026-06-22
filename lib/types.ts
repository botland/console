export type ServingMode = 'ray_cluster' | 'litellm_standalone';
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
}

export interface NodeRoles {
  head: boolean;
  litellm_proxy: boolean;
}

export interface NodeConfig {
  id: string;
  hostname: string;
  ip: string;
  roles: NodeRoles;
  gpus_reserved_for_system: number;
  labels: string[];
  status: NodeStatus;
  gpus: GpuDevice[];
}

export interface ClusterConfig {
  serving_mode: ServingMode;
  preferred_head_node_id: string;
  global_defaults: {
    autoscale_enabled: boolean;
  };
}

export type ModelSource =
  | { type: 'huggingface'; repo_id: string; hf_token?: string }
  | { type: 'local_path'; path: string };

export interface AutoscalingConfig {
  min_replicas: number;
  max_replicas: number;
  target_ongoing_requests: number;
}

export interface DeploymentAdvanced {
  context_length: number;
  quantization: string | null;
  num_replicas: number;
  tensor_parallel_size: number;
  pipeline_parallel_size: number;
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
  advanced: DeploymentAdvanced;
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
  version: 1;
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

export interface ApplianceStatus {
  state: ApplianceState;
  last_error: string | null;
  last_reconcile_ts: number;
  events: ReconcileEvent[];
  download_progress?: {
    bytes: number;
    file: string;
  };
}

export interface MockState {
  config: ApplianceConfig;
  status: ApplianceStatus;
  storage_usage: {
    total_bytes: number;
    used_bytes: number;
    paths: Record<string, { name: string; size_bytes: number; type: 'dir' | 'file' }[]>;
  };
}

export interface PlannerRecommendation {
  num_replicas: number;
  tensor_parallel_size: number;
  pipeline_parallel_size: number;
  context_length: number;
  warnings: string[];
}