import fs from 'fs';
import path from 'path';

import { normalizeClusterPatch } from '@/lib/orchestration';
import { parseApplianceConfig } from '@/lib/schema';
import type {
  ApplianceConfig,
  ApplianceStatus,
  ClusterConfig,
  DeploymentConfig,
  GatewayInfo,
  HeadChangedPayload,
  MigrateHeadResult,
  MockState,
  NodeAgentState,
  NodeConfig,
  OrchestrationConfig,
  OrchestrationPutResponse,
  ReconcileEvent,
  StorageMount,
} from '@/lib/types';

import { createSeedState } from './seed';

function getDataDir(): string {
  return process.env.APPLIANCE_CONSOLE_DATA_DIR ?? path.join(process.cwd(), '.data');
}

function getStateFile(): string {
  return path.join(getDataDir(), 'state.json');
}

let memoryState: MockState | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let agentTimer: ReturnType<typeof setInterval> | null = null;
const wsListeners: Set<(payload: unknown) => void> = new Set();

const AGENT_INTERVAL_MS = 5000;
const AGENT_STALE_MS = 15000;

/** Mirrors controller GET /orchestration read-only field (env default: manual placement). */
export function mockFederationAutoPlacementEnabled(): boolean {
  const raw = process.env.FEDERATION_AUTO_PLACEMENT?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0';
}

export function withOrchestrationExtras(cluster: ClusterConfig): OrchestrationConfig {
  return {
    ...cluster,
    federation_auto_placement: mockFederationAutoPlacementEnabled(),
  };
}

export function orchestrationPutResponse(cluster: ClusterConfig): OrchestrationPutResponse {
  return {
    ...withOrchestrationExtras(cluster),
    reconcile_seq: null,
  };
}

function ensureDir() {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function headPayload(config: ApplianceConfig): HeadChangedPayload {
  const head = config.nodes.find((n) => n.id === config.cluster.head_node_id);
  return {
    head_node_id: config.cluster.head_node_id,
    head_ip: head?.ip ?? config.system.network.head_ip,
    head_epoch: config.cluster.head_epoch,
  };
}

function migrateStateOnLoad(state: MockState): MockState {
  const raw = state.config as ApplianceConfig & { version?: number };
  if (raw.version !== 2) {
    state.config = parseApplianceConfig(raw);
  }
  if (!state.status.head) {
    state.status.head = headPayload(state.config);
  }
  if (!state.local_node_id) {
    state.local_node_id = state.config.cluster.head_node_id;
  }
  if (!state.agents) {
    state.agents = seedAgentsFromConfig(state.config);
  }
  syncHeadFlags(state.config);
  return state;
}

function seedAgentsFromConfig(config: ApplianceConfig): Record<string, NodeAgentState> {
  const now = Date.now();
  const headId = config.cluster.head_node_id;
  const agents: Record<string, NodeAgentState> = {};
  for (const node of config.nodes) {
    agents[node.id] = {
      node_id: node.id,
      last_seen: now,
      heartbeat_ts: now,
      agent_phase: node.status === 'online' ? 'running' : 'idle',
      head_target_node_id: headId,
    };
  }
  return agents;
}

function persist(state: MockState) {
  ensureDir();
  fs.writeFileSync(getStateFile(), JSON.stringify(state, null, 2));
  memoryState = state;
}

function loadFromDisk(): MockState | null {
  try {
    const stateFile = getStateFile();
    if (fs.existsSync(stateFile)) {
      const raw = fs.readFileSync(stateFile, 'utf-8');
      return migrateStateOnLoad(JSON.parse(raw) as MockState);
    }
  } catch {
    /* use seed */
  }
  return null;
}

export function subscribeWs(listener: (payload: unknown) => void): () => void {
  wsListeners.add(listener);
  return () => wsListeners.delete(listener);
}

function broadcast(channel: string, data: unknown) {
  const msg = { channel, data, ts: Date.now() };
  for (const fn of wsListeners) fn(msg);
}

export function getState(): MockState {
  if (memoryState) return memoryState;
  memoryState = loadFromDisk() ?? createSeedState();
  applyLocalNodeFromEnv(memoryState);
  ensureAgentSimulation();
  return memoryState;
}

function applyLocalNodeFromEnv(state: MockState): void {
  if (process.env.APPLIANCE_LOCAL_NODE_ID) {
    state.local_node_id = process.env.APPLIANCE_LOCAL_NODE_ID;
  }
}

export function saveState(state: MockState): MockState {
  persist(state);
  return state;
}

export function getConfig(): ApplianceConfig {
  return getState().config;
}

export function setConfig(config: unknown): ApplianceConfig {
  const parsed = parseApplianceConfig(config);
  const state = getState();
  state.config = parsed;
  syncHeadFlags(state.config);
  state.status.head = headPayload(state.config);
  saveState(state);
  return parsed;
}

export function addEvent(
  message: string,
  level: ReconcileEvent['level'] = 'info',
  extra?: Pick<ReconcileEvent, 'event' | 'reconcile_seq'>,
): void {
  const state = getState();
  state.status.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: new Date().toISOString(),
    message,
    level,
    ...extra,
  });
  state.status.events = state.status.events.slice(0, 50);
  state.status.last_reconcile_ts = Date.now() / 1000;
  saveState(state);
  broadcast('events', state.status.events[0]);
}

export function startReconcile(message: string): void {
  const state = getState();
  state.status.state = 'RECONCILING';
  state.status.last_error = message;
  addEvent(message, 'info');
  broadcast('cluster.state', { state: 'RECONCILING', last_error: message });

  if (reconcileTimer) clearTimeout(reconcileTimer);
  const duration = 3000 + Math.random() * 5000;
  reconcileTimer = setTimeout(() => {
    const s = getState();
    s.status.state = 'READY';
    s.status.last_error = null;
    for (const dep of s.config.deployments) {
      if (dep.enabled) dep.status = 'healthy';
    }
    addEvent('Model serving ready', 'info', { event: 'reconcile_ready' });
    broadcast('cluster.state', { state: 'READY', last_error: null });
    saveState(s);
  }, duration);
}

export function syncHeadFlags(config: ApplianceConfig): void {
  const headId = config.cluster.head_node_id;
  for (const node of config.nodes) {
    node.is_head = node.id === headId;
  }
  const head = config.nodes.find((n) => n.id === headId);
  if (head) {
    config.system.network.head_ip = head.ip;
  }
}

export function updateCluster(partial: Partial<ApplianceConfig['cluster']>): ApplianceConfig {
  const state = getState();
  const prevHead = state.config.cluster.head_node_id;

  if (partial.head_node_id && partial.head_node_id !== prevHead) {
    migrateHead(partial.head_node_id);
    return getState().config;
  }

  state.config.cluster = normalizeClusterPatch(state.config.cluster, partial);
  syncHeadFlags(state.config);
  state.status.head = headPayload(state.config);
  saveState(state);
  startReconcile('Cluster settings updated — rescheduling deployments');
  return state.config;
}

export function migrateHead(newHeadNodeId: string): MigrateHeadResult {
  const state = getState();
  const fromId = state.config.cluster.head_node_id;
  const newHead = state.config.nodes.find((n) => n.id === newHeadNodeId);

  if (!newHead) {
    return {
      success: false,
      error: 'Node not found',
      head: state.status.head,
      impact: { from_node_id: fromId, to_node_id: newHeadNodeId, deployments_rescheduled: 0 },
    };
  }

  if (newHead.status !== 'online') {
    return {
      success: false,
      error: 'New head node must be online',
      head: state.status.head,
      impact: { from_node_id: fromId, to_node_id: newHeadNodeId, deployments_rescheduled: 0 },
    };
  }

  if (fromId === newHeadNodeId) {
    return {
      success: true,
      head: state.status.head,
      impact: { from_node_id: fromId, to_node_id: newHeadNodeId, deployments_rescheduled: 0 },
    };
  }

  const enabledCount = state.config.deployments.filter((d) => d.enabled).length;
  const fromNode = state.config.nodes.find((n) => n.id === fromId);

  state.config.cluster.head_node_id = newHeadNodeId;
  state.config.cluster.head_epoch += 1;
  syncHeadFlags(state.config);
  state.status.head = headPayload(state.config);
  repointAgentsToHead(state, newHeadNodeId);

  addEvent(
    `Head migrated from ${fromNode?.hostname ?? fromId} to ${newHead.hostname} (epoch ${state.config.cluster.head_epoch})`,
    'warn',
  );
  broadcast('head.changed', state.status.head);
  addEvent(
    `Workers repointed to head at ${state.status.head.head_ip} (epoch ${state.config.cluster.head_epoch})`,
    'info',
  );
  saveState(state);
  startReconcile(`Head migration — rescheduling ${enabledCount} deployment(s)`);

  return {
    success: true,
    head: state.status.head,
    impact: {
      from_node_id: fromId,
      to_node_id: newHeadNodeId,
      deployments_rescheduled: enabledCount,
    },
  };
}

export function detachFromCluster(): import('@/lib/types').OrchestrationPutResponse {
  const state = getState();
  const localId = state.local_node_id;
  const cluster = state.config.cluster;
  if (cluster.head_node_id === localId) {
    throw new Error('Coordinator cannot detach from its own cluster');
  }
  if (cluster.serving_mode !== 'distributed') {
    throw new Error('Detach is only available while in distributed mode');
  }
  const localNode = state.config.nodes.find((n) => n.id === localId);
  const localIp = localNode?.ip ?? state.config.system.network.head_ip;
  cluster.serving_mode = 'standalone';
  cluster.compute_backend = 'federation';
  cluster.head_gpu = true;
  cluster.head_node_id = localId;
  cluster.head_epoch += 1;
  state.config.system.network.head_ip = localIp;
  syncHeadFlags(state.config);
  state.status.head = headPayload(state.config);
  addEvent(`Node ${localId} detached from cluster — now standalone`, 'warn');
  saveState(state);
  startReconcile('Detached from cluster — restarting standalone inference');
  return orchestrationPutResponse(cluster);
}

export function joinCluster(
  coordinatorAddress: string,
): import('@/lib/types').OrchestrationPutResponse & { coordinator_console_url?: string } {
  const state = getState();
  const localId = state.local_node_id;
  const cluster = state.config.cluster;
  if (cluster.serving_mode !== 'standalone') {
    throw new Error('Join is only available in standalone mode');
  }
  const host = coordinatorAddress.replace(/^https?:\/\//, '').split(':')[0].trim();
  const coordinator = state.config.nodes.find((n) => n.ip === host || n.id === host);
  const headNode = coordinator ?? state.config.nodes.find((n) => n.is_head);
  if (!headNode || headNode.id === localId) {
    throw new Error('Coordinator not found — open its console first or check the address');
  }
  cluster.serving_mode = 'distributed';
  cluster.compute_backend = cluster.compute_backend ?? 'federation';
  cluster.head_node_id = headNode.id;
  cluster.head_epoch = Math.max(cluster.head_epoch, headNode.is_head ? cluster.head_epoch : 1);
  state.config.system.network.head_ip = headNode.ip;
  syncHeadFlags(state.config);
  state.status.head = headPayload(state.config);
  repointAgentsToHead(state, headNode.id);
  addEvent(`Joined cluster at coordinator ${headNode.hostname} (${headNode.ip})`, 'warn');
  saveState(state);
  startReconcile('Joined cluster — rescheduling workloads');
  return {
    ...orchestrationPutResponse(cluster),
    coordinator_console_url: `http://${headNode.ip}/console`,
  };
}

export function updateNode(nodeId: string, partial: Partial<NodeConfig>): NodeConfig | null {
  const state = getState();
  const idx = state.config.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return null;

  const node = { ...state.config.nodes[idx], ...partial, id: nodeId };
  state.config.nodes[idx] = node;

  if (partial.is_head) {
    migrateHead(nodeId);
    return state.config.nodes[idx];
  }

  saveState(state);
  return node;
}

function deploymentAssignedToNode(dep: DeploymentConfig, nodeId: string): boolean {
  const targets = dep.placement?.targets ?? [];
  return targets.some((target) => target.node_id === nodeId);
}

function normalizeDeploymentStatus(dep: DeploymentConfig): DeploymentConfig {
  return {
    ...dep,
    status: dep.enabled ? dep.status : 'stopped',
  };
}

export function listDeployments(): DeploymentConfig[] {
  const state = getState();
  if (isHeadCoordinator()) {
    return state.config.deployments.map(normalizeDeploymentStatus);
  }
  const localId = getLocalNodeId();
  return state.config.deployments
    .filter((dep) => dep.enabled && deploymentAssignedToNode(dep, localId))
    .map((dep) => ({
      ...dep,
      enabled: true,
      status: dep.status === 'stopped' ? 'reconciling' : dep.status,
    }));
}

export function getDeployment(id: string): DeploymentConfig | undefined {
  return getState().config.deployments.find((d) => d.id === id);
}

export function createDeployment(dep: DeploymentConfig): DeploymentConfig {
  const state = getState();
  const saved: DeploymentConfig = {
    ...dep,
    status: dep.enabled ? 'reconciling' : 'stopped',
  };
  state.config.deployments.push(saved);
  saveState(state);
  if (saved.enabled) startReconcile(`Deploying ${saved.display_name}`);
  return saved;
}

export function updateDeployment(id: string, dep: DeploymentConfig): DeploymentConfig | null {
  const state = getState();
  const idx = state.config.deployments.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const saved: DeploymentConfig = {
    ...dep,
    id,
    status: dep.enabled ? 'reconciling' : 'stopped',
  };
  state.config.deployments[idx] = saved;
  saveState(state);
  if (saved.enabled) {
    startReconcile(`Updating deployment ${saved.display_name}`);
  } else {
    addEvent(`Disabled deployment ${saved.display_name}`, 'info');
  }
  return saved;
}

export function deleteDeployment(id: string): boolean {
  const state = getState();
  const before = state.config.deployments.length;
  state.config.deployments = state.config.deployments.filter((d) => d.id !== id);
  if (state.config.deployments.length < before) {
    saveState(state);
    startReconcile(`Removed deployment ${id}`);
    return true;
  }
  return false;
}

export function updateSystem(system: ApplianceConfig['system']): ApplianceConfig {
  const state = getState();
  state.config.system = system;
  saveState(state);
  startReconcile('System settings applied');
  return state.config;
}

export function addMount(mount: StorageMount): StorageMount {
  const state = getState();
  state.config.storage.mounts.push(mount);
  saveState(state);
  addEvent(`Storage mount added: ${mount.local_path}`, 'info');
  return mount;
}

export function removeMount(id: string): boolean {
  const state = getState();
  const before = state.config.storage.mounts.length;
  state.config.storage.mounts = state.config.storage.mounts.filter((m) => m.id !== id);
  if (state.config.storage.mounts.length < before) {
    saveState(state);
    return true;
  }
  return false;
}

function repointAgentsToHead(state: MockState, headNodeId: string): void {
  for (const agent of Object.values(state.agents)) {
    agent.head_target_node_id = headNodeId;
  }
}

function nodeMetricsPayload(state: MockState) {
  return {
    nodes: state.config.nodes.map((n) => ({
      id: n.id,
      gpus: n.gpus.map((g) => ({
        index: g.index,
        utilization_pct: g.utilization_pct,
      })),
      agent: state.agents[n.id],
    })),
  };
}

export function ingestAgentHeartbeat(nodeId: string): void {
  if (!isHeadCoordinator()) return;

  const state = getState();
  const node = state.config.nodes.find((n) => n.id === nodeId);
  const agent = state.agents[nodeId];
  if (!node || !agent || node.status === 'offline') return;

  for (const gpu of node.gpus) {
    const base = gpu.utilization_pct ?? 50;
    const delta = (Math.sin(Date.now() / 8000 + gpu.index + nodeId.length) + 1) * 5;
    gpu.utilization_pct = Math.min(95, Math.max(5, Math.round(base * 0.95 + delta)));
  }

  const now = Date.now();
  agent.last_seen = now;
  agent.heartbeat_ts = now;
  agent.agent_phase = 'running';
  agent.head_target_node_id = state.config.cluster.head_node_id;

  broadcast('node.metrics', nodeMetricsPayload(state));
}

function refreshAgentHealth(state: MockState): void {
  const now = Date.now();
  for (const node of state.config.nodes) {
    const agent = state.agents[node.id];
    if (!agent) continue;
    if (node.status === 'offline') {
      agent.agent_phase = 'idle';
      continue;
    }
    if (now - agent.last_seen > AGENT_STALE_MS) {
      agent.agent_phase = 'degraded';
    }
  }
}

export function tickAgents(): void {
  const state = getState();
  refreshAgentHealth(state);
  if (!isHeadCoordinator()) return;
  for (const node of state.config.nodes) {
    if (node.status === 'online') {
      ingestAgentHeartbeat(node.id);
    }
  }
}

export function ensureAgentSimulation(): void {
  if (process.env.APPLIANCE_DISABLE_AGENT_SIM === '1') return;
  if (agentTimer) return;
  tickAgents();
  agentTimer = setInterval(tickAgents, AGENT_INTERVAL_MS);
}

export function stopAgentSimulation(): void {
  if (agentTimer) {
    clearInterval(agentTimer);
    agentTimer = null;
  }
}

export function getStatus(): ApplianceStatus {
  const state = getState();
  tickAgents();
  state.status.head = headPayload(state.config);
  return state.status;
}

export function listNodesWithAgents(): Array<NodeConfig & { agent?: NodeAgentState }> {
  const state = getState();
  refreshAgentHealth(state);
  return state.config.nodes.map((node) => ({
    ...node,
    agent: state.agents[node.id],
  }));
}

export function getGatewayStatus(): GatewayInfo {
  const config = getConfig();
  const port = process.env.APPLIANCE_PORT ?? '3000';
  const base =
    process.env.APPLIANCE_HEAD_INTERNAL_URL?.replace(/\/$/, '') ??
    `http://${config.system.network.head_ip}:${port}`;
  // OpenWebUI owns host /api; management API is under console basePath.
  const apiPath =
    process.env.NEXT_PUBLIC_BASE_PATH || process.env.CONSOLE_BASE_PATH
      ? `${(process.env.NEXT_PUBLIC_BASE_PATH || process.env.CONSOLE_BASE_PATH || '/console').replace(/\/$/, '')}/api`
      : '/console/api';
  return {
    local_node_id: getLocalNodeId(),
    is_head: isHeadCoordinator(),
    head_api_url: base.endsWith('/api') ? base : `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`,
  };
}

export function getStorage() {
  return getState().storage_usage;
}

const _RO_INTENT =
  'Uses this data to answer questions. Does not change anything.';

const MOCK_CAPABILITIES: import('@/lib/types').CapabilityPack[] = [
  {
    id: 'corpus.read',
    description: 'Answers questions from the appliance knowledge corpus',
    enabled: true,
    pack: 'platform',
    pack_version: '1.0.0',
    mcp_server: '',
    allowed_tools: ['knowledge_list', 'knowledge_search', 'knowledge_read'],
    docs: 'Mock: corpus pack always on.',
    health: { status: 'up', detail: 'mock' },
    configured: true,
    configured_detail: 'mock corpus',
    read_only: true,
    intent_summary: _RO_INTENT,
    approval_required: false,
    changes_need_approval: false,
    policy_valid: true,
  },
  {
    id: 'git.search',
    description: 'Answers questions from a Git repository',
    enabled: false,
    pack: 'git_ro',
    pack_version: '1.0.0',
    mcp_server: 'git_ro',
    allowed_tools: ['git_list_refs', 'git_log', 'git_search', 'git_read_file'],
    docs: 'Mount a repo at configs/mcp/repos.',
    health: { status: 'up', detail: 'mock' },
    configured: false,
    configured_detail: 'no repo in mock',
    read_only: true,
    intent_summary: _RO_INTENT,
    approval_required: false,
    changes_need_approval: false,
    policy_valid: true,
  },
  {
    id: 's3.read',
    description: 'Lists and reads objects from an S3-compatible bucket',
    enabled: false,
    pack: 's3_ro',
    pack_version: '1.0.0',
    mcp_server: 's3_ro',
    allowed_tools: ['s3_list_objects', 's3_get_object'],
    docs: 'Set S3_BUCKET and AWS credentials.',
    health: { status: 'up', detail: 'mock' },
    configured: false,
    configured_detail: 'not configured',
    read_only: true,
    intent_summary: _RO_INTENT,
    approval_required: false,
    changes_need_approval: false,
    policy_valid: true,
  },
  {
    id: 'sql.query',
    description: 'Runs read-only SQL (SELECT) against a mounted database',
    enabled: false,
    pack: 'sql_ro',
    pack_version: '1.0.0',
    mcp_server: 'sql_ro',
    allowed_tools: ['sql_list_tables', 'sql_query', 'sql_describe_table'],
    docs: 'Set SQL_PATH to a sqlite file.',
    health: { status: 'up', detail: 'mock' },
    configured: false,
    configured_detail: 'not configured',
    read_only: true,
    intent_summary: _RO_INTENT,
    approval_required: false,
    changes_need_approval: false,
    policy_valid: true,
  },
  {
    id: 'corpus.propose_write',
    description: 'AI can propose documentation edits. Changes need your approval before they apply.',
    enabled: false,
    pack: 'platform',
    pack_version: '1.0.0',
    mcp_server: '',
    allowed_tools: [
      'knowledge_prepare_patch',
      'knowledge_preview_patch',
      'knowledge_list_pending',
    ],
    docs: 'Staging corpus only. Prepare via AI; Apply under Pending changes.',
    health: { status: 'up', detail: 'mock' },
    configured: true,
    configured_detail: 'mock staging',
    read_only: false,
    intent_summary: 'Can propose changes. Nothing is applied without your approval.',
    approval_required: true,
    changes_need_approval: true,
    policy_valid: true,
  },
  {
    id: 'draft.create',
    description: 'AI can create new draft notes. Existing documents are never modified.',
    enabled: false,
    pack: 'platform',
    pack_version: '1.0.0',
    mcp_server: '',
    allowed_tools: ['note_create_draft', 'note_list_drafts'],
    docs: 'Creates new files under staging/drafts/ only.',
    health: { status: 'up', detail: 'mock' },
    configured: true,
    configured_detail: 'mock drafts',
    read_only: false,
    intent_summary: 'Can create new items only. Existing data is never modified.',
    approval_required: false,
    changes_need_approval: false,
    policy_valid: true,
  },
  {
    id: 'corpus.propose_archive',
    description:
      'AI can propose moving staging files to trash. Always needs your confirmation. Not permanent delete.',
    enabled: false,
    pack: 'platform',
    pack_version: '1.0.0',
    mcp_server: '',
    allowed_tools: [
      'knowledge_prepare_archive',
      'knowledge_preview_patch',
      'knowledge_list_pending',
    ],
    docs: 'Soft-archive only. Apply under Pending changes. Rollback supported.',
    health: { status: 'up', detail: 'mock' },
    configured: true,
    configured_detail: 'mock staging',
    read_only: false,
    intent_summary:
      'Can propose high-impact or delete actions. Always needs your confirmation.',
    approval_required: true,
    changes_need_approval: true,
    policy_valid: true,
  },
];

let mockCapabilityState = structuredClone(MOCK_CAPABILITIES);

let mockPendingChanges: import('@/lib/types').PendingChange[] = [];

export function listCapabilities(): import('@/lib/types').CapabilitiesResponse {
  return {
    mcp_enabled: true,
    tenant_id: mockPlatform.tenant_id,
    allow_rw_capabilities: false,
    capabilities: structuredClone(mockCapabilityState),
  };
}

export function listPendingChanges(
  status = 'pending',
): { mutations: import('@/lib/types').PendingChange[]; count: number } {
  const filtered =
    status && status !== 'all' && status !== '*'
      ? mockPendingChanges.filter((m) => m.status === status)
      : mockPendingChanges;
  return { mutations: structuredClone(filtered), count: filtered.length };
}

export function applyPendingChange(
  id: string,
  body: { preview_checksum: string; ack: string },
): import('@/lib/types').PendingChange {
  const idx = mockPendingChanges.findIndex((m) => m.mutation_id === id);
  if (idx < 0) throw new Error('Unknown pending change');
  const m = mockPendingChanges[idx];
  if (m.status === 'committed') {
    return { ...structuredClone(m), idempotent_replay: true };
  }
  if (m.status !== 'pending') throw new Error(`Cannot apply status ${m.status}`);
  if (!body.ack?.trim()) throw new Error('Confirmation required');
  if (body.preview_checksum !== m.preview_checksum) throw new Error('Preview checksum mismatch');
  mockPendingChanges[idx] = {
    ...m,
    status: 'committed',
    committed_at: new Date().toISOString(),
    commit_actor: 'mock',
    rollback_ref: `noop:${id}`,
  };
  return { ...structuredClone(mockPendingChanges[idx]), idempotent_replay: false };
}

export function discardPendingChange(id: string): import('@/lib/types').PendingChange {
  const idx = mockPendingChanges.findIndex((m) => m.mutation_id === id);
  if (idx < 0) throw new Error('Unknown pending change');
  mockPendingChanges[idx] = { ...mockPendingChanges[idx], status: 'cancelled' };
  return structuredClone(mockPendingChanges[idx]);
}

/** Test helper: seed a pending change in mock mode. */
export function mockSeedPendingChange(
  partial?: Partial<import('@/lib/types').PendingChange>,
): import('@/lib/types').PendingChange {
  const id = partial?.mutation_id ?? `mock-mut-${mockPendingChanges.length + 1}`;
  const row: import('@/lib/types').PendingChange = {
    capability_id: 'corpus.propose_write',
    title: 'Mock documentation edits',
    summary: 'AI prepared 2 documentation edits',
    preview_text: 'Update getting-started.txt',
    preview: { items: [{ path: 'getting-started.txt' }] },
    preview_checksum: 'sha256:mock',
    created_at: new Date().toISOString(),
    changes_need_approval: true,
    ...partial,
    mutation_id: id,
    status: partial?.status ?? 'pending',
  };
  mockPendingChanges = [...mockPendingChanges.filter((m) => m.mutation_id !== id), row];
  return structuredClone(row);
}

export function setCapabilityEnabled(
  id: string,
  enabled: boolean,
  _extra?: { access_mode?: 'ro' | 'rw'; ack_message?: string },
): import('@/lib/types').CapabilityPack {
  const idx = mockCapabilityState.findIndex((c) => c.id === id);
  if (idx < 0) {
    throw new Error(`Unknown capability: ${id}`);
  }
  mockCapabilityState[idx] = { ...mockCapabilityState[idx], enabled };
  return structuredClone(mockCapabilityState[idx]);
}

let mockPlatform: import('@/lib/types').PlatformSnapshot = {
  tenant_id: 'default',
  rag: {
    version: '1',
    tenant_id: 'default',
    embedding_model_id: '',
    embedding_dim: 384,
    chunker_version: 'plain-v1',
    default_corpus_id: 'appliance',
    hybrid_default: true,
  },
  prompts: [],
  acl: {
    version: '1',
    tenant_id: 'default',
    group_capabilities: {},
    rw_admin_roles: ['appliance-admin'],
    sso_enabled: false,
    notes: 'Mock ACL — SSO not enabled.',
  },
  grants: [],
  sources: [],
  allow_rw_capabilities: false,
  agent_runtime: 'none',
  versions: [],
};

let mockSources: import('@/lib/types').SourceInstanceDto[] = [
  {
    id: 'builtin-appliance-knowledge',
    typeId: 'appliance-knowledge',
    displayName: 'Appliance knowledge',
    config: {},
    enabledPermissionIds: ['read'],
    groups: ['Everyone'],
    packBound: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resourceUri: 'knowledge://builtin-appliance-knowledge/collections/default',
    scheme: 'knowledge',
  },
];

export function listSources(): import('@/lib/types').SourcesResponse {
  return {
    sources: structuredClone(mockSources),
    count: mockSources.length,
    sso_enabled: false,
    note: 'mock source registry',
  };
}

export function createSource(
  body: Record<string, unknown>,
): import('@/lib/types').SourceInstanceDto {
  const now = new Date().toISOString();
  const id = String(body.id || `src_${Date.now()}`);
  const row: import('@/lib/types').SourceInstanceDto = {
    id,
    typeId: String(body.typeId ?? body.type_id ?? 'postgresql'),
    displayName: String(body.displayName ?? body.display_name ?? 'Source'),
    config: (body.config as Record<string, string>) ?? {},
    enabledPermissionIds: (body.enabledPermissionIds as string[]) ?? [],
    groups: (body.groups as string[]) ?? ['Admins'],
    packBound: Boolean(body.packBound),
    createdAt: now,
    updatedAt: now,
    resourceUri: `sql://${id}`,
    scheme: 'sql',
  };
  mockSources = [...mockSources, row];
  mockPlatform = { ...mockPlatform, sources: structuredClone(mockSources) };
  return structuredClone(row);
}

export function patchSource(
  id: string,
  body: Record<string, unknown>,
): import('@/lib/types').SourceInstanceDto {
  const idx = mockSources.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`source not found: ${id}`);
  const prev = mockSources[idx];
  const next: import('@/lib/types').SourceInstanceDto = {
    ...prev,
    displayName: String(body.displayName ?? body.display_name ?? prev.displayName),
    config: (body.config as Record<string, string>) ?? prev.config,
    enabledPermissionIds:
      (body.enabledPermissionIds as string[]) ??
      (body.enabled_permission_ids as string[]) ??
      prev.enabledPermissionIds,
    groups: (body.groups as string[]) ?? prev.groups,
    packBound:
      body.packBound !== undefined || body.pack_bound !== undefined
        ? Boolean(body.packBound ?? body.pack_bound)
        : prev.packBound,
    updatedAt: new Date().toISOString(),
  };
  mockSources = mockSources.map((s, i) => (i === idx ? next : s));
  mockPlatform = { ...mockPlatform, sources: structuredClone(mockSources) };
  return structuredClone(next);
}

export function deleteSource(id: string): { deleted: boolean; id: string } {
  if (id.startsWith('builtin-')) {
    throw new Error('cannot delete builtin pack-bound instance');
  }
  mockSources = mockSources.filter((s) => s.id !== id);
  mockPlatform = { ...mockPlatform, sources: structuredClone(mockSources) };
  return { deleted: true, id };
}

const mockAccessAudit: import('@/lib/types').AccessAuditDecision[] = [
  {
    id: 1,
    ts: Date.now() / 1000 - 120,
    subject: 'alice@example.com',
    tenant_id: 'default',
    action: 'query',
    resource: 'sql://finance-db/invoices',
    allowed: true,
    reason: 'capability_and_source_allowed',
    source: 'headers',
    auth_mode: 'headers',
  },
  {
    id: 2,
    ts: Date.now() / 1000 - 60,
    subject: 'bob@example.com',
    tenant_id: 'default',
    action: 'tool',
    resource: 'sql_query',
    allowed: false,
    reason: 'group_capability_denied',
    source: 'headers',
    auth_mode: 'headers',
  },
];

export function getAccessSummary(): import('@/lib/types').AccessSummaryResponse {
  return {
    pep: {
      mode: 'soft',
      effective_mode: 'soft',
      proxy_enabled: true,
      v1_via_controller: true,
      sso_enabled: false,
    },
    sessions_active: 0,
    sources_count: mockSources.length,
    audit: { sample_size: mockAccessAudit.length, allowed: 1, denied: 1 },
    caller: {
      subject: 'mock-operator',
      groups: ['Everyone'],
      tools_allowed: 4,
      tools_denied: 1,
    },
    readiness: {
      overall: 'lab_ok',
      overall_label: 'Lab posture (acceptable for single-tenant demos)',
    },
    links: {
      console_access: '/console/access',
      audit: '/access/audit',
      ready: '/access/ready',
    },
  };
}

export function getAccessReady(): import('@/lib/types').AccessReadyResponse {
  return {
    overall: 'lab_ok',
    overall_label: 'Lab posture (acceptable for single-tenant demos)',
    checks: [
      {
        id: 'pep_mode',
        title: 'MCP PEP mode',
        status: 'warn',
        detail: 'Configured soft, effective soft — anonymous tools/call may pass (logged).',
        remediation: 'Set OWNEDGE_MCP_PEP_MODE=strict for production multi-user.',
      },
      {
        id: 'v1_path',
        title: 'Chat via controller',
        status: 'pass',
        detail: 'OWNEDGE_V1_VIA_CONTROLLER routes /v1 chat through identity-aware proxy.',
      },
    ],
    checklist: [
      'OWNEDGE_MCP_PEP_MODE=strict for multi-user production',
      'OWNEDGE_OIDC_VERIFY=true + ISSUER/JWKS when using OIDC',
    ],
  };
}

export function listAccessAudit(params?: {
  limit?: number;
  subject?: string;
  allowed?: boolean;
}): import('@/lib/types').AccessAuditResponse {
  let rows = structuredClone(mockAccessAudit);
  if (params?.subject) {
    rows = rows.filter((r) => r.subject === params.subject);
  }
  if (params?.allowed != null) {
    rows = rows.filter((r) => r.allowed === params.allowed);
  }
  const limit = params?.limit ?? 100;
  rows = rows.slice(0, limit);
  return {
    count: rows.length,
    decisions: rows,
    viewer: 'mock-admin',
    admin_view: true,
  };
}

export function getPepStatus(): import('@/lib/types').PepStatusResponse {
  return {
    mode: 'soft',
    effective_mode: 'soft',
    sso_enabled: false,
    sso_strict_elevation: true,
    proxy_enabled: true,
    proxy_base: 'http://controller:8080',
    v1_via_controller: true,
    chat_proxy: '/v1/chat/completions',
    corpus_search: '/corpus/search',
    active_sessions: 0,
    note: 'mock PEP status',
  };
}

export function knowledgeSearch(
  body: Record<string, unknown>,
): import('@/lib/types').KnowledgeSearchResponse {
  const q = String(body.query || '');
  return {
    query: q,
    hits: [
      {
        source_uri: 'corpus://demo/welcome.md',
        score: 0.91,
        text: `Mock hit for “${q || '…'}” (appliance knowledge).`,
        title: 'welcome.md',
      },
    ],
    mode: 'hybrid',
    groups_applied: ['Everyone'],
    policy_reason: 'mock_allow',
    resource_uri: 'knowledge://builtin-appliance-knowledge/collections/default',
    auth: { subject: 'mock-operator', groups: ['Everyone'] },
  };
}

export function sqlQuery(
  body: Record<string, unknown>,
): import('@/lib/types').SqlQueryResponse {
  const sql = String(body.sql || '');
  return {
    backend: 'sqlite',
    backend_label: 'sqlite:mock',
    columns: ['n', 'note'],
    rows: [[1, `mock result for: ${sql.slice(0, 40)}`]],
    row_count: 1,
    truncated: false,
    policy_reason: 'mock_allow',
    resource_uri: 'sql://mock-db',
    auth: { subject: 'mock-operator', groups: ['Admins'] },
  };
}

export function listEffectiveTools(): import('@/lib/types').EffectiveToolsResponse {
  return {
    allowed_tools: ['knowledge_search', 'knowledge_list', 'knowledge_read', 'sql_query'],
    denied_tools: [{ tool: 'knowledge_prepare_patch', reason: 'capability_disabled' }],
    subject: 'mock-operator',
    count_allowed: 4,
    count_denied: 1,
    auth: {
      subject: 'mock-operator',
      groups: ['Everyone'],
      roles: ['user'],
      source: 'headers',
    },
    sso_enabled: false,
    residual_risks: [],
    note: 'mock effective tools',
  };
}

export function getPlatform(): import('@/lib/types').PlatformSnapshot {
  mockPlatform = { ...mockPlatform, sources: structuredClone(mockSources) };
  return structuredClone(mockPlatform);
}

export function putPlatformTenant(tenant_id: string): import('@/lib/types').PlatformSnapshot {
  mockPlatform = {
    ...mockPlatform,
    tenant_id,
    rag: { ...mockPlatform.rag, tenant_id },
  };
  return structuredClone(mockPlatform);
}

export function putPlatformRag(
  rag: import('@/lib/types').RagConfig,
): import('@/lib/types').PlatformSnapshot {
  mockPlatform = { ...mockPlatform, rag, tenant_id: rag.tenant_id || mockPlatform.tenant_id };
  return structuredClone(mockPlatform);
}

let mockWorkflows: import('@/lib/types').WorkflowRecord[] = [];

export function listWorkflows(_tenant_id?: string): {
  workflows: import('@/lib/types').WorkflowRecord[];
} {
  return { workflows: structuredClone(mockWorkflows) };
}

export function generateWorkflow(body: {
  prompt: string;
  name?: string;
  tenant_id?: string;
  save_as_draft?: boolean;
}): {
  workflow?: import('@/lib/types').WorkflowRecord;
  source: string;
  saved: boolean;
} {
  const id = `wf-mock-${Date.now()}`;
  const version: import('@/lib/types').WorkflowVersion = {
    workflow_id: id,
    version: '1',
    status: 'draft',
    name: body.name || body.prompt.slice(0, 40) || 'Mock workflow',
    description: 'Generated in mock mode',
    definition: {
      steps: [
        {
          id: 's1',
          title: 'Retrieve knowledge',
          kind: 'retrieval',
          risk: 'low',
          capability_id: 'corpus.read',
        },
        {
          id: 's2',
          title: 'Draft answer',
          kind: 'llm',
          risk: 'low',
        },
      ],
      edges: [{ source: 's1', target: 's2' }],
      read_only: true,
    },
    source: 'template',
    nl_prompt: body.prompt,
    tenant_id: body.tenant_id || 'default',
    created_at: new Date().toISOString(),
  };
  const rec: import('@/lib/types').WorkflowRecord = {
    id,
    tenant_id: body.tenant_id || 'default',
    name: version.name,
    description: version.description,
    current_version: '1',
    published_version: null,
    created_at: version.created_at,
    updated_at: version.created_at,
    versions: [version],
  };
  if (body.save_as_draft !== false) {
    mockWorkflows = [rec, ...mockWorkflows];
    return { workflow: structuredClone(rec), source: 'template', saved: true };
  }
  return { source: 'template', saved: false };
}

export function transitionWorkflow(
  id: string,
  version: string,
  status: string,
  _note = '',
): import('@/lib/types').WorkflowVersion {
  const wf = mockWorkflows.find((w) => w.id === id);
  if (!wf) throw new Error('Not found');
  const ver = wf.versions.find((v) => v.version === version);
  if (!ver) throw new Error('Version not found');
  ver.status = status as import('@/lib/types').WorkflowStatus;
  if (status === 'published') {
    wf.published_version = version;
    for (const v of wf.versions) {
      if (v.version !== version && v.status === 'published') v.status = 'deprecated';
    }
  }
  return structuredClone(ver);
}

export function dryRunWorkflow(
  id: string,
  version: string,
): import('@/lib/types').DryRunResult {
  const wf = mockWorkflows.find((w) => w.id === id);
  const ver = wf?.versions.find((v) => v.version === version);
  if (!ver) {
    return {
      ok: false,
      workflow_id: id,
      version,
      errors: ['not found'],
      warnings: [],
      step_plan: [],
      runtime: 'none',
      detail: 'mock',
    };
  }
  return {
    ok: true,
    workflow_id: id,
    version,
    errors: [],
    warnings: [],
    step_plan: ver.definition.steps.map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
    })),
    runtime: 'none',
    detail: 'Mock dry-run — agent runtime is none',
  };
}

export function getLocalNodeId(): string {
  if (process.env.APPLIANCE_LOCAL_NODE_ID) {
    return process.env.APPLIANCE_LOCAL_NODE_ID;
  }
  return getState().local_node_id;
}

export function isHeadCoordinator(): boolean {
  const state = getState();
  return getLocalNodeId() === state.config.cluster.head_node_id;
}

/** @deprecated use isHeadCoordinator */
export function isHeadGateway(): boolean {
  return isHeadCoordinator();
}

/** Reset in-memory and on-disk state — for tests only. */
export function resetTestState(options?: {
  seed?: boolean;
  persist?: boolean;
  clearDisk?: boolean;
}): void {
  const { seed = true, persist: shouldPersist = false, clearDisk = true } = options ?? {};
  if (reconcileTimer) {
    clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }
  stopAgentSimulation();
  wsListeners.clear();
  memoryState = null;
  mockPendingChanges = [];
  mockCapabilityState = structuredClone(MOCK_CAPABILITIES);
  const stateFile = getStateFile();
  if (clearDisk && fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
  if (seed) {
    const next = createSeedState();
    memoryState = next;
    if (shouldPersist) {
      persist(next);
    }
  }
}