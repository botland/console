import { withBasePath } from '@/lib/base-path';
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

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type StatusResponse = ApplianceStatus & {
  config: ApplianceConfig | null;
  config_error?: string;
  gateway: GatewayInfo | null;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  // withBasePath: prefixes /console on appliances (or /demo in marketing builds).
  const res = await fetch(withBasePath(url), init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error ?? res.statusText;
    throw new ApiError(message, res.status);
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

  exportConfig: () => window.open(withBasePath('/api/config/export'), '_blank'),

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

  getOrchestration: () => fetchJson<ClusterConfig>('/api/orchestration'),

  putOrchestration: (cluster: ClusterConfig) =>
    fetchJson<import('@/lib/types').OrchestrationPutResponse>('/api/orchestration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cluster),
    }),

  /** @deprecated Use getOrchestration */
  getCluster: () => fetchJson<ClusterConfig>('/api/orchestration'),

  /** @deprecated Use putOrchestration */
  putCluster: (cluster: ClusterConfig) =>
    fetchJson<ClusterConfig>('/api/orchestration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cluster),
    }),

  migrateHead: (head_node_id: string) =>
    fetchJson<MigrateHeadResult>('/api/orchestration/migrate-head', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ head_node_id }),
    }),

  detachFromCluster: () =>
    fetchJson<import('@/lib/types').OrchestrationPutResponse>('/api/orchestration/detach', {
      method: 'POST',
    }),

  joinCluster: (coordinator_address: string) =>
    fetchJson<import('@/lib/types').OrchestrationPutResponse & { coordinator_console_url?: string }>(
      '/api/orchestration/join',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinator_address }),
      },
    ),

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

  supportEntitlement: () => fetchJson<import('@/lib/support/types').EntitlementResponse>('/api/support/entitlement'),

  supportPreview: (note = '') =>
    fetchJson<import('@/lib/support/types').DiagnosticBundle>(
      `/api/support/preview?note=${encodeURIComponent(note)}`,
    ),

  supportSubmit: (userNote = '') =>
    fetchJson<{ ticket_id: string; status: string }>('/api/support/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_note: userNote }),
    }),

  supportTicket: (id: string) =>
    fetchJson<import('@/lib/support/types').TicketStatusResponse>(`/api/support/tickets/${id}`),

  supportTickets: () =>
    fetchJson<import('@/lib/support/types').TicketListResponse>('/api/support/tickets'),
};