import * as mock from '@/lib/mock/store';
import type {
  ApplianceConfig,
  ApplianceStatus,
  ClusterConfig,
  DeploymentConfig,
  GatewayInfo,
  MigrateHeadResult,
  NodeAgentState,
  NodeConfig,
  OrchestrationPutResponse,
  StorageMount,
} from '@/lib/types';

import * as inferedge from './inferedge';
import { isInferedgeRuntime } from './mode';

export { isInferedgeRuntime, getRuntimeMode } from './mode';
export { ControllerError } from './client';

export function subscribeWs(listener: (payload: unknown) => void): () => void {
  return mock.subscribeWs(listener);
}

export async function getStatus(): Promise<ApplianceStatus> {
  return isInferedgeRuntime() ? inferedge.getStatus() : mock.getStatus();
}

export async function getConfig(): Promise<ApplianceConfig> {
  return isInferedgeRuntime() ? inferedge.getConfig() : mock.getConfig();
}

export async function getOrchestration(): Promise<ClusterConfig> {
  if (isInferedgeRuntime()) return inferedge.getOrchestration();
  return mock.withOrchestrationExtras(mock.getConfig().cluster);
}

/** @deprecated Use getOrchestration */
export async function getCluster(): Promise<ClusterConfig> {
  return getOrchestration();
}

export async function setConfig(config: unknown): Promise<ApplianceConfig> {
  return isInferedgeRuntime() ? inferedge.setConfig(config) : mock.setConfig(config);
}

export async function putOrchestration(cluster: ClusterConfig): Promise<OrchestrationPutResponse> {
  if (isInferedgeRuntime()) {
    return inferedge.updateOrchestration(cluster);
  }
  const config = mock.updateCluster(cluster);
  return mock.orchestrationPutResponse(config.cluster);
}

export async function updateOrchestration(partial: Partial<ClusterConfig>): Promise<ApplianceConfig> {
  if (isInferedgeRuntime()) {
    if (partial.head_node_id) {
      const current = await inferedge.getOrchestration();
      if (partial.head_node_id !== current.head_node_id) {
        await inferedge.migrateHead(partial.head_node_id);
        return inferedge.getConfig();
      }
    }
    const current = await inferedge.getOrchestration();
    await inferedge.updateOrchestration({ ...current, ...partial });
    const config = await inferedge.getConfig();
    return config;
  }
  return mock.updateCluster(partial);
}

/** @deprecated Use updateOrchestration */
export async function updateCluster(partial: Partial<ClusterConfig>): Promise<ApplianceConfig> {
  return updateOrchestration(partial);
}

export async function migrateHead(newHeadNodeId: string): Promise<MigrateHeadResult> {
  return isInferedgeRuntime() ? inferedge.migrateHead(newHeadNodeId) : mock.migrateHead(newHeadNodeId);
}

export async function detachFromCluster(): Promise<OrchestrationPutResponse> {
  return isInferedgeRuntime() ? inferedge.detachFromCluster() : mock.detachFromCluster();
}

export async function joinCluster(
  coordinatorAddress: string,
): Promise<OrchestrationPutResponse & { coordinator_console_url?: string }> {
  return isInferedgeRuntime()
    ? inferedge.joinCluster(coordinatorAddress)
    : mock.joinCluster(coordinatorAddress);
}

export async function listNodesWithAgents(): Promise<Array<NodeConfig & { agent?: NodeAgentState }>> {
  return isInferedgeRuntime() ? inferedge.listNodesWithAgents() : mock.listNodesWithAgents();
}

export async function updateNode(nodeId: string, partial: Partial<NodeConfig>): Promise<NodeConfig | null> {
  return isInferedgeRuntime() ? inferedge.updateNode(nodeId, partial) : mock.updateNode(nodeId, partial);
}

export async function listDeployments(): Promise<DeploymentConfig[]> {
  return isInferedgeRuntime() ? inferedge.listDeployments() : mock.listDeployments();
}

export async function getDeployment(id: string): Promise<DeploymentConfig | undefined> {
  return isInferedgeRuntime() ? inferedge.getDeployment(id) : mock.getDeployment(id);
}

export async function createDeployment(dep: DeploymentConfig): Promise<DeploymentConfig> {
  return isInferedgeRuntime() ? inferedge.createDeployment(dep) : mock.createDeployment(dep);
}

export async function updateDeployment(
  id: string,
  dep: DeploymentConfig,
): Promise<DeploymentConfig | null> {
  return isInferedgeRuntime() ? inferedge.updateDeployment(id, dep) : mock.updateDeployment(id, dep);
}

export async function deleteDeployment(id: string): Promise<boolean> {
  return isInferedgeRuntime() ? inferedge.deleteDeployment(id) : mock.deleteDeployment(id);
}

export async function updateSystem(system: ApplianceConfig['system']): Promise<ApplianceConfig> {
  return isInferedgeRuntime() ? inferedge.updateSystem(system) : mock.updateSystem(system);
}

export async function addMount(mount: StorageMount): Promise<StorageMount> {
  return isInferedgeRuntime() ? inferedge.addMount(mount) : mock.addMount(mount);
}

export async function removeMount(id: string): Promise<boolean> {
  return isInferedgeRuntime() ? inferedge.removeMount(id) : mock.removeMount(id);
}

export async function getStorage() {
  return isInferedgeRuntime() ? inferedge.getStorage() : mock.getStorage();
}

export async function listCapabilities() {
  return isInferedgeRuntime() ? inferedge.listCapabilities() : mock.listCapabilities();
}

export async function setCapabilityEnabled(
  id: string,
  enabled: boolean,
  extra?: { access_mode?: 'ro' | 'rw'; ack_message?: string },
) {
  return isInferedgeRuntime()
    ? inferedge.setCapabilityEnabled(id, enabled, extra)
    : mock.setCapabilityEnabled(id, enabled, extra);
}

export async function getPlatform() {
  return isInferedgeRuntime() ? inferedge.getPlatform() : mock.getPlatform();
}

export async function putPlatformTenant(tenant_id: string) {
  return isInferedgeRuntime()
    ? inferedge.putPlatformTenant(tenant_id)
    : mock.putPlatformTenant(tenant_id);
}

export async function putPlatformRag(rag: import('@/lib/types').RagConfig) {
  return isInferedgeRuntime() ? inferedge.putPlatformRag(rag) : mock.putPlatformRag(rag);
}

export async function getGatewayStatus(): Promise<GatewayInfo> {
  return isInferedgeRuntime() ? inferedge.getGatewayStatus() : mock.getGatewayStatus();
}

export async function getLocalNodeId(): Promise<string> {
  if (process.env.APPLIANCE_LOCAL_NODE_ID) {
    return process.env.APPLIANCE_LOCAL_NODE_ID;
  }
  if (isInferedgeRuntime()) {
    const gateway = await inferedge.getGatewayStatus();
    return gateway.local_node_id;
  }
  return mock.getLocalNodeId();
}

export async function isHeadCoordinator(): Promise<boolean> {
  const localNodeId = await getLocalNodeId();
  if (isInferedgeRuntime()) {
    const gateway = await inferedge.getGatewayStatus();
    return gateway.is_head;
  }
  const config = mock.getConfig();
  return localNodeId === config.cluster.head_node_id;
}

export async function importConfig(config: unknown): Promise<{ applied: boolean; error?: string }> {
  return isInferedgeRuntime() ? inferedge.importConfig(config) : importConfigMock(config);
}

async function importConfigMock(config: unknown): Promise<{ applied: boolean; error?: string }> {
  try {
    mock.setConfig(config);
    mock.startReconcile('Configuration imported — applying changes');
    return { applied: true };
  } catch (error) {
    return {
      applied: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

export async function exportConfigResponse(): Promise<Response> {
  if (isInferedgeRuntime()) {
    return inferedge.exportConfigResponse();
  }
  const { toSortedJson } = await import('@/lib/sort-json');
  const config = mock.getConfig();
  const body = toSortedJson(config);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="conf.json"',
    },
  });
}

export async function proxyWsStream(): Promise<Response> {
  return inferedge.proxyWsStream();
}

export async function getSupportDiagnostics(): Promise<import('@/lib/support/types').SupportDiagnostics> {
  if (isInferedgeRuntime()) {
    return inferedge.getSupportDiagnostics();
  }
  const { getConfig } = await import('@/lib/mock/store');
  const { mockSupportDiagnostics } = await import('@/lib/support/diagnostics');
  const config = getConfig();
  return mockSupportDiagnostics(config.appliance_id);
}

export async function getControllerVersion(): Promise<string> {
  if (isInferedgeRuntime()) {
    return inferedge.getControllerVersion();
  }
  return 'mock';
}

export function resetTestState(options?: Parameters<typeof mock.resetTestState>[0]): void {
  mock.resetTestState(options);
}