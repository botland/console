import { parseApplianceConfig } from '@/lib/schema';
import type {
  ApplianceConfig,
  ApplianceState,
  ApplianceStatus,
  ClusterConfig,
  GatewayInfo,
  MigrateHeadResult,
  NodeAgentState,
  NodeConfig,
  StorageMount,
} from '@/lib/types';

import { ControllerError, controllerFetch, controllerJson } from './client';

interface InferedgeStatusResponse {
  state: string;
  last_error?: string | null;
  last_reconcile_ts?: number | null;
  head?: {
    head_node_id: string;
    head_ip: string;
    head_epoch: number;
  };
  gateway?: GatewayInfo;
  events?: Array<{
    id: string;
    timestamp: string;
    message: string;
    level: 'info' | 'warn' | 'error';
  }>;
  actual?: {
    download_bytes?: number | null;
    download_current_file?: string | null;
  };
}

function mapApplianceState(state: string): ApplianceState {
  if (state === 'FAILED') return 'DEGRADED';
  if (state === 'READY' || state === 'RECONCILING' || state === 'DEGRADED' || state === 'BOOT') {
    return state;
  }
  return 'DEGRADED';
}

function mapStatus(raw: InferedgeStatusResponse): ApplianceStatus {
  const downloadBytes = raw.actual?.download_bytes;
  return {
    state: mapApplianceState(raw.state),
    last_error: raw.last_error ?? null,
    last_reconcile_ts: raw.last_reconcile_ts ?? Date.now() / 1000,
    events: raw.events ?? [],
    head: raw.head ?? {
      head_node_id: '',
      head_ip: '',
      head_epoch: 1,
    },
    download_progress:
      downloadBytes != null
        ? {
            bytes: downloadBytes,
            file: raw.actual?.download_current_file ?? '',
          }
        : undefined,
  };
}

export async function getStatus(): Promise<ApplianceStatus> {
  const raw = await controllerJson<InferedgeStatusResponse>('/status');
  return mapStatus(raw);
}

export async function getConfig(): Promise<ApplianceConfig> {
  const raw = await controllerJson<unknown>('/config');
  return parseApplianceConfig(raw);
}

export async function getCluster(): Promise<ClusterConfig> {
  return controllerJson<ClusterConfig>('/cluster');
}

export async function updateCluster(partial: ClusterConfig): Promise<ClusterConfig> {
  return controllerJson<ClusterConfig>('/cluster', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
}

export async function migrateHead(newHeadNodeId: string): Promise<MigrateHeadResult> {
  try {
    return await controllerJson<MigrateHeadResult>('/cluster/migrate-head', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ head_node_id: newHeadNodeId }),
    });
  } catch (error) {
    if (error instanceof ControllerError) {
      let detail = error.body;
      try {
        const parsed = JSON.parse(error.body) as { detail?: string };
        detail = parsed.detail ?? error.body;
      } catch {
        /* use raw body */
      }
      const status = await getStatus();
      return {
        success: false,
        error: detail,
        head: status.head,
        impact: {
          from_node_id: status.head.head_node_id,
          to_node_id: newHeadNodeId,
          deployments_rescheduled: 0,
        },
      };
    }
    throw error;
  }
}

export async function listNodesWithAgents(): Promise<Array<NodeConfig & { agent?: NodeAgentState }>> {
  return controllerJson<Array<NodeConfig & { agent?: NodeAgentState }>>('/nodes');
}

export async function importConfig(config: unknown): Promise<{ applied: boolean; error?: string }> {
  try {
    await controllerJson<{ accepted: boolean; head_node_id: string }>('/config/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return { applied: true };
  } catch (error) {
    if (error instanceof ControllerError) {
      let detail = error.body;
      try {
        const parsed = JSON.parse(error.body) as { detail?: string };
        detail = parsed.detail ?? error.body;
      } catch {
        /* use raw body */
      }
      return { applied: false, error: detail };
    }
    throw error;
  }
}

export async function exportConfigResponse(): Promise<Response> {
  const response = await controllerFetch('/config/export');
  if (!response.ok) {
    const body = await response.text();
    throw new ControllerError(response.status, body);
  }
  const headers = new Headers(response.headers);
  if (!headers.has('Content-Disposition')) {
    headers.set('Content-Disposition', 'attachment; filename="conf.json"');
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function getGatewayStatus(): Promise<GatewayInfo> {
  const raw = await controllerJson<InferedgeStatusResponse>('/status');
  if (raw.gateway) {
    const headApiUrl = process.env.APPLIANCE_HEAD_INTERNAL_URL
      ? `${process.env.APPLIANCE_HEAD_INTERNAL_URL.replace(/\/$/, '')}/api`
      : raw.gateway.head_api_url;
    return { ...raw.gateway, head_api_url: headApiUrl };
  }

  const port = process.env.APPLIANCE_PORT ?? '3000';
  const headIp = raw.head?.head_ip ?? '127.0.0.1';
  const localNodeId = process.env.APPLIANCE_LOCAL_NODE_ID ?? raw.head?.head_node_id ?? '';
  return {
    local_node_id: localNodeId,
    is_head: localNodeId !== '' && localNodeId === raw.head?.head_node_id,
    head_api_url: `http://${headIp}:${port}/api`,
  };
}

export async function proxyWsStream(): Promise<Response> {
  const response = await controllerFetch('/v1/ws');
  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new ControllerError(response.status, body);
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function setConfig(config: unknown): Promise<ApplianceConfig> {
  const raw = await controllerJson<unknown>('/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return parseApplianceConfig(raw);
}

export async function startReconcile(_message: string): Promise<void> {
  /* import triggers reconcile on controller; no-op here */
}

export async function updateNode(
  nodeId: string,
  partial: Partial<NodeConfig>,
): Promise<NodeConfig | null> {
  try {
    return await controllerJson<NodeConfig>(`/nodes/${encodeURIComponent(nodeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  } catch (error) {
    if (error instanceof ControllerError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function listDeployments(): Promise<import('@/lib/types').DeploymentConfig[]> {
  return controllerJson('/deployments');
}

export async function getDeployment(
  id: string,
): Promise<import('@/lib/types').DeploymentConfig | undefined> {
  try {
    return await controllerJson(`/deployments/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ControllerError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function createDeployment(
  dep: import('@/lib/types').DeploymentConfig,
): Promise<import('@/lib/types').DeploymentConfig> {
  return controllerJson('/deployments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dep),
  });
}

export async function updateDeployment(
  id: string,
  dep: import('@/lib/types').DeploymentConfig,
): Promise<import('@/lib/types').DeploymentConfig | null> {
  try {
    return await controllerJson(`/deployments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    });
  } catch (error) {
    if (error instanceof ControllerError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function deleteDeployment(id: string): Promise<boolean> {
  const result = await controllerJson<{ deleted: boolean }>(
    `/deployments/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return result.deleted;
}

export async function updateSystem(system: ApplianceConfig['system']): Promise<ApplianceConfig> {
  await controllerJson('/system', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(system),
  });
  return getConfig();
}

export async function addMount(mount: StorageMount): Promise<StorageMount> {
  return controllerJson<StorageMount>('/storage/mounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mount),
  });
}

export async function removeMount(id: string): Promise<boolean> {
  const result = await controllerJson<{ deleted: boolean }>(
    `/storage/mounts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return result.deleted;
}

export async function getStorage(): Promise<import('@/lib/types').MockState['storage_usage']> {
  return controllerJson('/storage');
}