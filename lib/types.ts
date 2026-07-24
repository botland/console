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
  /** Plain-language what the pack does (no internal risk labels). */
  intent_summary?: string;
  approval_required?: boolean;
  changes_need_approval?: boolean;
  policy_valid?: boolean;
  policy_error?: string | null;
}

export interface CapabilitiesResponse {
  mcp_enabled: boolean;
  tenant_id?: string;
  allow_rw_capabilities?: boolean;
  capabilities: CapabilityPack[];
}

/** Pending change prepared by AI; Apply/Discard only (product vocabulary). */
export interface PendingChange {
  mutation_id: string;
  tenant_id?: string;
  capability_id: string;
  status: 'pending' | 'committed' | 'cancelled' | 'expired';
  title?: string;
  summary?: string;
  preview_text?: string;
  preview?: Record<string, unknown> | unknown;
  preview_checksum: string;
  created_by?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  commit_actor?: string | null;
  committed_at?: string | null;
  rollback_ref?: string | null;
  changes_need_approval?: boolean;
  idempotent_replay?: boolean;
}

export interface RagConfig {
  version: string;
  tenant_id: string;
  embedding_model_id: string;
  embedding_dim: number;
  chunker_version: string;
  default_corpus_id: string;
  hybrid_default: boolean;
  /** When true, retrieval refuses hash fallback for vector ingest/search */
  require_real_embeddings?: boolean;
}

export interface RagChecklistItem {
  id: string;
  status: 'ok' | 'todo' | 'warn' | 'error' | string;
  detail: string;
}

export interface RagHealthResponse {
  rag: RagConfig;
  retrieval: {
    status?: string;
    qdrant?: string;
    collection?: string;
    points?: number | null;
    embedding_model_id?: string;
    indexed_embedding_model_id?: string | null;
    vector_size?: number | null;
    require_real_embeddings?: boolean;
    uses_hash_fallback?: boolean;
    reindex_needed?: boolean;
    detail?: string;
  };
  checklist: RagChecklistItem[];
  ready: boolean;
}

export interface CorpusReindexResponse {
  ok: boolean;
  actor?: string;
  tenant_id?: string;
  corpus_id?: string;
  documents?: number;
  chunks?: number;
  embedding_model_id?: string;
  previous_embedding_model_id?: string;
  errors?: string[];
  [key: string]: unknown;
}

export type WorkflowStatus = 'draft' | 'review' | 'published' | 'deprecated';

export interface WorkflowStep {
  id: string;
  title: string;
  kind: 'llm' | 'retrieval' | 'tool' | 'hitl' | 'note';
  description?: string;
  params?: Record<string, unknown>;
  risk?: 'low' | 'medium' | 'high';
  requires_hitl?: boolean;
  tool_name?: string | null;
  capability_id?: string | null;
}

export interface WorkflowGraph {
  steps: WorkflowStep[];
  edges: Array<{ source: string; target: string }>;
  parameters?: Array<{
    name: string;
    label?: string;
    type?: string;
    default?: unknown;
    min?: number;
    max?: number;
    description?: string;
  }>;
  read_only?: boolean;
}

export interface WorkflowVersion {
  workflow_id: string;
  version: string;
  status: WorkflowStatus;
  name: string;
  description: string;
  definition: WorkflowGraph;
  source: 'nl' | 'manual' | 'template';
  nl_prompt?: string;
  tenant_id: string;
  created_at: string;
  created_by?: string | null;
  published_at?: string | null;
}

export interface WorkflowRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  current_version: string | null;
  published_version: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  versions: WorkflowVersion[];
}

export interface DryRunResult {
  ok: boolean;
  workflow_id: string;
  version: string;
  errors: string[];
  warnings: string[];
  step_plan: Array<Record<string, unknown>>;
  runtime: string;
  detail: string;
}

/** Server-side source instance (ACCESS_POLICIES Phase 3 registry). */
export interface SourceInstanceDto {
  id: string;
  typeId: string;
  type_id?: string;
  displayName: string;
  display_name?: string;
  config: Record<string, string>;
  enabledPermissionIds: string[];
  enabled_permission_ids?: string[];
  groups: string[];
  packBound: boolean;
  pack_bound?: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  resourceUri?: string | null;
  scheme?: string | null;
}

export interface SourcesResponse {
  sources: SourceInstanceDto[];
  count: number;
  sso_enabled?: boolean;
  note?: string;
}

export interface AccessAuditDecision {
  id?: number;
  ts: number;
  subject: string;
  tenant_id?: string;
  action: string;
  resource: string;
  allowed: boolean;
  reason: string;
  groups_fp?: string;
  auth_mode?: string;
  source?: string;
  detail?: Record<string, unknown>;
}

export interface AccessAuditResponse {
  count: number;
  decisions: AccessAuditDecision[];
  viewer?: string;
  admin_view?: boolean;
}

export interface PepStatusResponse {
  mode: string;
  effective_mode?: string;
  sso_enabled?: boolean;
  sso_strict_elevation?: boolean;
  proxy_enabled?: boolean;
  proxy_base?: string;
  v1_via_controller?: boolean;
  litellm_base?: string;
  chat_proxy?: string;
  knowledge_search?: string;
  active_sessions?: number;
  note?: string;
}

export interface KnowledgeSearchHit {
  chunk_id?: string;
  source_uri?: string;
  score?: number;
  text?: string;
  title?: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  hits: KnowledgeSearchHit[];
  mode?: string;
  groups_applied?: string[];
  policy_reason?: string;
  resource_uri?: string;
  auth?: { subject?: string; groups?: string[] };
}

export interface SqlQueryResponse {
  backend?: string;
  backend_label?: string;
  columns: string[];
  rows: unknown[][];
  row_count?: number;
  truncated?: boolean;
  policy_reason?: string;
  resource_uri?: string;
  auth?: { subject?: string; groups?: string[] };
}

export interface AccessSummaryResponse {
  pep: {
    mode: string;
    effective_mode?: string;
    proxy_enabled?: boolean;
    v1_via_controller?: boolean;
    sso_enabled?: boolean;
  };
  sessions_active?: number;
  sources_count?: number;
  audit?: {
    sample_size?: number;
    allowed?: number;
    denied?: number;
  };
  caller?: {
    subject?: string;
    groups?: string[];
    source?: string;
    tools_allowed?: number;
    tools_denied?: number;
  };
  readiness?: {
    overall?: string;
    overall_label?: string;
  } | null;
  links?: Record<string, string>;
}

export interface AccessReadyCheck {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  remediation?: string;
}

export interface AccessReadyResponse {
  overall: string;
  overall_label: string;
  checks: AccessReadyCheck[];
  config?: Record<string, unknown>;
  checklist?: string[];
}

export interface EffectiveToolsResponse {
  allowed_tools: string[];
  denied_tools: Array<{ tool: string; reason: string }>;
  decisions?: Array<{
    tool: string;
    allowed: boolean;
    reason: string;
    capability_id?: string | null;
    resource?: string;
  }>;
  subject?: string;
  count_allowed?: number;
  count_denied?: number;
  auth?: {
    subject?: string;
    groups?: string[];
    roles?: string[];
    tenant_id?: string;
    source?: string;
    auth_mode?: string;
  };
  sso_enabled?: boolean;
  residual_risks?: string[];
  note?: string;
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
  /** Present when controller registry is available (Phase 3). */
  sources?: SourceInstanceDto[];
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

export interface AccessPlaneStatus {
  overall?: string | null;
  overall_label?: string | null;
  pep_mode?: string | null;
  effective_pep_mode?: string | null;
  sso_enabled?: boolean | null;
  v1_via_controller?: boolean | null;
  fail_count?: number;
  warn_count?: number;
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
  /** Present when controller reports access-plane readiness */
  access_plane?: AccessPlaneStatus | null;
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