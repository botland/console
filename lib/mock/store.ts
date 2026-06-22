import fs from 'fs';
import path from 'path';

import { applianceConfigSchema } from '@/lib/schema';
import type {
  ApplianceConfig,
  ApplianceStatus,
  DeploymentConfig,
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

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
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
      return JSON.parse(raw) as MockState;
    }
  } catch {
    /* use seed */
  }
  return null;
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

export function setConfig(config: ApplianceConfig): ApplianceConfig {
  const parsed = applianceConfigSchema.parse(config);
  const state = getState();
  state.config = parsed;
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
}

export function startReconcile(message: string): void {
  const state = getState();
  state.status.state = 'RECONCILING';
  state.status.last_error = message;
  addEvent(message, 'info');

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
    saveState(s);
  }, duration);
}

export function updateCluster(partial: Partial<ApplianceConfig['cluster']>): ApplianceConfig {
  const state = getState();
  state.config.cluster = { ...state.config.cluster, ...partial };
  syncNodeRoles(state.config);
  saveState(state);
  startReconcile('Cluster settings updated — rescheduling deployments');
  return state.config;
}

export function syncNodeRoles(config: ApplianceConfig): void {
  const headId = config.cluster.preferred_head_node_id;
  const litellmMode = config.cluster.serving_mode === 'litellm_standalone';

  for (const node of config.nodes) {
    node.roles.head = node.id === headId;
    node.roles.litellm_proxy = litellmMode && node.id === headId;
  }

  config.system.network.head_ip =
    config.nodes.find((n) => n.id === headId)?.ip ?? config.system.network.head_ip;
}

export function updateNode(nodeId: string, partial: Partial<NodeConfig>): NodeConfig | null {
  const state = getState();
  const idx = state.config.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return null;

  const node = { ...state.config.nodes[idx], ...partial, id: nodeId };
  state.config.nodes[idx] = node;

  if (partial.roles?.head || node.roles.head) {
    state.config.cluster.preferred_head_node_id = nodeId;
    syncNodeRoles(state.config);
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
  // Simulate slowly shifting GPU utilization
  for (const node of state.config.nodes) {
    for (const gpu of node.gpus) {
      const base = gpu.utilization_pct ?? 50;
      const delta = (Math.sin(Date.now() / 8000 + gpu.index) + 1) * 5;
      gpu.utilization_pct = Math.min(95, Math.max(5, Math.round(base * 0.95 + delta)));
    }
  }
  return state.status;
}

export function getStorage() {
  return getState().storage_usage;
}