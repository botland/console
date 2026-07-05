import { resolveComputeBackend } from '@/lib/orchestration';
import type { NodeConfig, OrchestrationConfig } from '@/lib/types';

export interface DeploymentFormMode {
  standalone: boolean;
  distributed: boolean;
  federation: boolean;
  clusterBackend: boolean;
  federationDiverse: boolean;
  federationReplicated: boolean;
  showNodesPerInstance: boolean;
  showAutoscaling: boolean;
  showPlacement: boolean;
  placementRequired: boolean;
}

export function resolveDeploymentFormMode(
  cluster: OrchestrationConfig,
): DeploymentFormMode {
  const standalone = cluster.serving_mode === 'standalone';
  const distributed = cluster.serving_mode === 'distributed';
  const federation = resolveComputeBackend(cluster) === 'federation';
  const clusterBackend = resolveComputeBackend(cluster) === 'cluster';
  const layout = cluster.federation_layout ?? 'replicated';
  const federationDiverse = distributed && federation && layout === 'diverse';
  const federationReplicated = distributed && federation && layout === 'replicated';
  const manualPlacement = cluster.federation_auto_placement === false;

  return {
    standalone,
    distributed,
    federation,
    clusterBackend,
    federationDiverse,
    federationReplicated,
    showNodesPerInstance: distributed && clusterBackend,
    showAutoscaling: clusterBackend,
    showPlacement: distributed && federation && manualPlacement,
    placementRequired: distributed && federation && manualPlacement,
  };
}

export function availableGpus(node: NodeConfig): number[] {
  const reserved = Math.max(0, Math.min(node.gpus_reserved_for_system, node.gpus.length));
  return node.gpus.slice(reserved).map((gpu) => gpu.index);
}