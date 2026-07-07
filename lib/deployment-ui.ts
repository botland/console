import { resolveComputeBackend } from '@/lib/orchestration';
import type {
  DeploymentConfig,
  DeploymentPlacement,
  NodeConfig,
  OrchestrationConfig,
} from '@/lib/types';

export interface DeploymentFormMode {
  standalone: boolean;
  distributed: boolean;
  federation: boolean;
  clusterBackend: boolean;
  federationDiverse: boolean;
  federationReplicated: boolean;
  showNodesPerInstance: boolean;
  showAutoscaling: boolean;
  canChoosePlacement: boolean;
  showPlacement: boolean;
  placementRequired: boolean;
}

export function resolvePlacementMode(
  placement?: DeploymentPlacement,
  cluster?: OrchestrationConfig,
): 'auto' | 'manual' {
  if (placement?.mode === 'manual' || placement?.mode === 'auto') {
    return placement.mode;
  }
  if (placement?.targets?.length) {
    return 'manual';
  }
  if (cluster?.federation_auto_placement === false) {
    return 'manual';
  }
  return 'auto';
}

export function deploymentUsesManualPlacement(
  deployment?: Pick<DeploymentConfig, 'placement'>,
  cluster?: OrchestrationConfig,
): boolean {
  return resolvePlacementMode(deployment?.placement, cluster) === 'manual';
}

export function resolveDeploymentFormMode(
  cluster: OrchestrationConfig,
  deployment?: Pick<DeploymentConfig, 'placement'>,
): DeploymentFormMode {
  const standalone = cluster.serving_mode === 'standalone';
  const distributed = cluster.serving_mode === 'distributed';
  const federation = resolveComputeBackend(cluster) === 'federation';
  const clusterBackend = resolveComputeBackend(cluster) === 'cluster';
  const layout = cluster.federation_layout ?? 'replicated';
  const federationDiverse = distributed && federation && layout === 'diverse';
  const federationReplicated = distributed && federation && layout === 'replicated';
  const canChoosePlacement = distributed && federation;
  const manualPlacement = canChoosePlacement && deploymentUsesManualPlacement(deployment, cluster);

  return {
    standalone,
    distributed,
    federation,
    clusterBackend,
    federationDiverse,
    federationReplicated,
    showNodesPerInstance: distributed && clusterBackend,
    showAutoscaling: clusterBackend,
    canChoosePlacement,
    showPlacement: manualPlacement,
    placementRequired: manualPlacement,
  };
}

export function availableGpus(node: NodeConfig): number[] {
  const reserved = Math.max(0, Math.min(node.gpus_reserved_for_system, node.gpus.length));
  return node.gpus.slice(reserved).map((gpu) => gpu.index);
}