import type {
  ApplianceConfig,
  ApplianceStatus,
  ClusterConfig,
  DeploymentConfig,
  GatewayInfo,
  MigrateHeadResult,
  NodeAgentState,
  NodeConfig,
  PlannerRecommendation,
  StorageMount,
  SystemConfig,
  ValidationResult,
} from '@/lib/types';

export type NodeWithAgent = NodeConfig & { agent?: NodeAgentState };

export type StatusResponse = ApplianceStatus & {
  config: ApplianceConfig;
  gateway: GatewayInfo;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  status: () => fetchJson<StatusResponse>('/api/status'),

  getConfig: () => fetchJson<ApplianceConfig>('/api/config'),

  putConfig: (config: ApplianceConfig) =>
    fetchJson<ApplianceConfig>('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  exportConfig: () => window.open('/api/config/export', '_blank'),

  importConfig: (config: unknown) =>
    fetchJson<{ applied: boolean }>('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  listDeployments: () => fetchJson<DeploymentConfig[]>('/api/deployments'),

  createDeployment: (dep: DeploymentConfig) =>
    fetchJson<DeploymentConfig>('/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    }),

  updateDeployment: (id: string, dep: DeploymentConfig) =>
    fetchJson<DeploymentConfig>(`/api/deployments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    }),

  deleteDeployment: (id: string) =>
    fetchJson<{ deleted: boolean }>(`/api/deployments/${id}`, { method: 'DELETE' }),

  recommend: (dep: DeploymentConfig) =>
    fetchJson<PlannerRecommendation>('/api/deployments/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    }),

  validate: (dep: DeploymentConfig) =>
    fetchJson<ValidationResult>('/api/deployments/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    }),

  getCluster: () => fetchJson<ClusterConfig>('/api/cluster'),

  putCluster: (cluster: ClusterConfig) =>
    fetchJson<ClusterConfig>('/api/cluster', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cluster),
    }),

  migrateHead: (head_node_id: string) =>
    fetchJson<MigrateHeadResult>('/api/cluster/migrate-head', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ head_node_id }),
    }),

  listNodes: () => fetchJson<NodeWithAgent[]>('/api/nodes'),

  updateNode: (id: string, node: Partial<NodeConfig>) =>
    fetchJson<NodeConfig>(`/api/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node),
    }),

  getSystem: () => fetchJson<SystemConfig>('/api/system'),

  putSystem: (system: SystemConfig) =>
    fetchJson<SystemConfig>('/api/system', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(system),
    }),

  getStorage: () =>
    fetchJson<{
      total_bytes: number;
      used_bytes: number;
      paths: Record<string, { name: string; size_bytes: number; type: string }[]>;
      mounts: StorageMount[];
    }>('/api/storage'),

  addMount: (mount: Omit<StorageMount, 'id'>) =>
    fetchJson<StorageMount>('/api/storage/mounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mount),
    }),

  deleteMount: (id: string) =>
    fetchJson<{ deleted: boolean }>(`/api/storage/mounts/${id}`, { method: 'DELETE' }),
};