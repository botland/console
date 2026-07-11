import type { ClusterConfig, ComputeBackend, OrchestrationConfig, ServingMode } from '@/lib/types';

export function defaultComputeBackend(servingMode: ServingMode): ComputeBackend {
  return servingMode === 'distributed' ? 'cluster' : 'federation';
}

export function resolveComputeBackend(cluster: ClusterConfig): ComputeBackend {
  return cluster.compute_backend ?? defaultComputeBackend(cluster.serving_mode);
}

/** Align cluster fields with controller validation before PUT /orchestration. */
export function normalizeClusterConfig(cluster: ClusterConfig): ClusterConfig {
  const next: ClusterConfig = { ...cluster };

  if (next.serving_mode === 'standalone') {
    if (resolveComputeBackend(next) === 'cluster') {
      next.compute_backend = 'federation';
    }
    // Standalone always serves on the local appliance; distributed head_gpu prefs
    // are restored server-side when switching back to distributed.
    if (next.head_gpu === false) {
      next.head_gpu = true;
    }
  }

  if (resolveComputeBackend(next) === 'cluster') {
    delete next.federation_layout;
  }

  return next;
}

export function normalizeClusterPatch(
  current: OrchestrationConfig,
  patch: Partial<OrchestrationConfig>,
): ClusterConfig {
  const { federation_auto_placement: _ignored, ...cluster } = { ...current, ...patch };
  return normalizeClusterConfig(cluster);
}

/** Strip read-only GET fields and invalid cross-mode keys before PUT /orchestration. */
export function toOrchestrationPutPayload(cluster: OrchestrationConfig): ClusterConfig {
  const { federation_auto_placement: _ignored, ...rest } = cluster;
  return normalizeClusterConfig(rest);
}