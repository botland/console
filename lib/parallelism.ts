import type { DeploymentConfig, ClusterInventory } from '@/lib/types';

export function gpusPerReplica(deployment: DeploymentConfig): number {
  return (
    Math.max(1, deployment.parallelism.gpus_per_instance) *
    Math.max(1, deployment.parallelism.nodes_per_instance)
  );
}

export function effectiveInstances(
  deployment: DeploymentConfig,
  inventory: ClusterInventory,
): number {
  if (deployment.user_intent.scale === 'auto') {
    const perReplica = gpusPerReplica(deployment);
    const slots = Math.floor(inventory.available_gpu_count / perReplica);
    const max = deployment.parallelism.autoscaling?.max_instances;
    if (max) return Math.max(0, Math.min(slots, max));
    return Math.max(1, slots);
  }
  return Math.max(1, deployment.parallelism.instances);
}

/** Peak GPU demand including Ray autoscale ceiling. */
export function peakGpuDemand(
  deployment: DeploymentConfig,
  inventory: ClusterInventory,
): number {
  const perReplica = gpusPerReplica(deployment);
  const autoscale = deployment.parallelism.autoscaling;
  if (autoscale) {
    return Math.max(1, autoscale.max_instances) * perReplica;
  }
  return effectiveInstances(deployment, inventory) * perReplica;
}