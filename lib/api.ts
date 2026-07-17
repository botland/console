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

  listCapabilities: () =>
    fetchJson<import('@/lib/types').CapabilitiesResponse>('/api/capabilities'),

  listPendingChanges: (status = 'pending') =>
    fetchJson<{ mutations: import('@/lib/types').PendingChange[]; count: number }>(
      `/api/mutations?status=${encodeURIComponent(status)}`,
    ),

  applyPendingChange: (id: string, body: { preview_checksum: string; ack: string }) =>
    fetchJson<import('@/lib/types').PendingChange>(
      `/api/mutations/${encodeURIComponent(id)}/commit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),

  discardPendingChange: (id: string) =>
    fetchJson<import('@/lib/types').PendingChange>(
      `/api/mutations/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    ),

  setCapabilityEnabled: (
    id: string,
    enabled: boolean,
    extra?: { access_mode?: 'ro' | 'rw'; ack_message?: string },
  ) =>
    fetchJson<import('@/lib/types').CapabilityPack>(`/api/capabilities/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, ...extra }),
    }),

  getPlatform: () => fetchJson<import('@/lib/types').PlatformSnapshot>('/api/platform'),

  putPlatformTenant: (tenant_id: string) =>
    fetchJson<import('@/lib/types').PlatformSnapshot>('/api/platform/tenant', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id }),
    }),

  putPlatformRag: (rag: import('@/lib/types').RagConfig) =>
    fetchJson<import('@/lib/types').PlatformSnapshot>('/api/platform/rag', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rag),
    }),

  listSources: () => fetchJson<import('@/lib/types').SourcesResponse>('/api/sources'),

  createSource: (body: Record<string, unknown>) =>
    fetchJson<import('@/lib/types').SourceInstanceDto>('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  patchSource: (id: string, body: Record<string, unknown>) =>
    fetchJson<import('@/lib/types').SourceInstanceDto>(`/api/sources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  deleteSource: (id: string) =>
    fetchJson<{ deleted: boolean; id: string }>(`/api/sources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getAccessSummary: () =>
    fetchJson<import('@/lib/types').AccessSummaryResponse>('/api/access/summary'),

  getAccessReady: () =>
    fetchJson<import('@/lib/types').AccessReadyResponse>('/api/access/ready'),

  listAccessAudit: (params?: { limit?: number; subject?: string; allowed?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.subject) q.set('subject', params.subject);
    if (params?.allowed != null) q.set('allowed', params.allowed ? 'true' : 'false');
    const qs = q.toString();
    return fetchJson<import('@/lib/types').AccessAuditResponse>(
      qs ? `/api/access/audit?${qs}` : '/api/access/audit',
    );
  },

  getPepStatus: () =>
    fetchJson<import('@/lib/types').PepStatusResponse>('/api/agent/pep/status'),

  knowledgeSearch: (body: { query: string; top_k?: number; mode?: string }) =>
    fetchJson<import('@/lib/types').KnowledgeSearchResponse>('/api/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  sqlQuery: (body: { sql: string; max_rows?: number; resource?: string }) =>
    fetchJson<import('@/lib/types').SqlQueryResponse>('/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  listEffectiveTools: () =>
    fetchJson<import('@/lib/types').EffectiveToolsResponse>('/api/agent/tools/effective'),

  listWorkflows: (tenant_id?: string) =>
    fetchJson<{ workflows: import('@/lib/types').WorkflowRecord[] }>(
      tenant_id
        ? `/api/workflows?tenant_id=${encodeURIComponent(tenant_id)}`
        : '/api/workflows',
    ),

  generateWorkflow: (body: {
    prompt: string;
    name?: string;
    tenant_id?: string;
    save_as_draft?: boolean;
  }) =>
    fetchJson<{
      workflow?: import('@/lib/types').WorkflowRecord;
      source: string;
      saved: boolean;
    }>('/api/workflows/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  transitionWorkflow: (id: string, version: string, status: string, note = '') =>
    fetchJson<import('@/lib/types').WorkflowVersion>(
      `/api/workflows/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/transition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      },
    ),

  dryRunWorkflow: (id: string, version: string) =>
    fetchJson<import('@/lib/types').DryRunResult>(
      `/api/workflows/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/dry-run`,
      { method: 'POST' },
    ),

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