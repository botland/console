import fs from 'fs';
import path from 'path';

import { parseApplianceConfig } from '@/lib/schema';
import type {
  ApplianceConfig,
  ApplianceStatus,
  DeploymentConfig,
  HeadChangedPayload,
  MigrateHeadResult,
  MockState,
  NodeConfig,
  ReconcileEvent,
  StorageMount,
} from '@/lib/types';

import { createSeedState } from './seed';

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

let memoryState: MockState | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
const wsListeners: Set<(payload: unknown) => void> = new Set();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
  syncHeadFlags(state.config);
  return state;
}

function persist(state: MockState) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  memoryState = state;
}

function loadFromDisk(): MockState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
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
  return memoryState;
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

export function addEvent(message: string, level: ReconcileEvent['level'] = 'info'): void {
  const state = getState();
  state.status.events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: new Date().toISOString(),
    message,
    level,
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
    addEvent('Reconciliation complete — all enabled deployments healthy', 'info');
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

  state.config.cluster = { ...state.config.cluster, ...partial };
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
  state.local_node_id = newHeadNodeId;

  addEvent(
    `Head migrated from ${fromNode?.hostname ?? fromId} to ${newHead.hostname} (epoch ${state.config.cluster.head_epoch})`,
    'warn',
  );
  broadcast('head.changed', state.status.head);
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

export function listDeployments(): DeploymentConfig[] {
  return getState().config.deployments;
}

export function getDeployment(id: string): DeploymentConfig | undefined {
  return getState().config.deployments.find((d) => d.id === id);
}

export function createDeployment(dep: DeploymentConfig): DeploymentConfig {
  const state = getState();
  state.config.deployments.push(dep);
  saveState(state);
  if (dep.enabled) startReconcile(`Deploying ${dep.display_name}`);
  return dep;
}

export function updateDeployment(id: string, dep: DeploymentConfig): DeploymentConfig | null {
  const state = getState();
  const idx = state.config.deployments.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  state.config.deployments[idx] = { ...dep, id };
  saveState(state);
  if (dep.enabled) startReconcile(`Updating deployment ${dep.display_name}`);
  return state.config.deployments[idx];
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

export function getStatus(): ApplianceStatus {
  const state = getState();
  for (const node of state.config.nodes) {
    for (const gpu of node.gpus) {
      const base = gpu.utilization_pct ?? 50;
      const delta = (Math.sin(Date.now() / 8000 + gpu.index) + 1) * 5;
      gpu.utilization_pct = Math.min(95, Math.max(5, Math.round(base * 0.95 + delta)));
    }
  }
  state.status.head = headPayload(state.config);
  broadcast('node.metrics', {
    nodes: state.config.nodes.map((n) => ({
      id: n.id,
      gpus: n.gpus.map((g) => ({
        index: g.index,
        utilization_pct: g.utilization_pct,
      })),
    })),
  });
  return state.status;
}

export function getStorage() {
  return getState().storage_usage;
}

export function getLocalNodeId(): string {
  return getState().local_node_id;
}

export function isHeadGateway(): boolean {
  const state = getState();
  return state.local_node_id === state.config.cluster.head_node_id;
}