import type { ApplianceConfig, DeploymentConfig } from '@/lib/types';

export function smallestOnlineGpuVramMb(
  config: ApplianceConfig,
  gpusPerInstance: number,
): number | null {
  let smallest: number | null = null;
  for (const node of config.nodes) {
    if (node.status !== 'online') continue;
    const available = node.gpus
      .slice(node.gpus_reserved_for_system)
      .map((gpu) => gpu.vram_mb)
      .sort((a, b) => a - b);
    if (available.length < gpusPerInstance) continue;
    const total = available.slice(0, gpusPerInstance).reduce((sum, mb) => sum + mb, 0);
    if (smallest === null || total < smallest) {
      smallest = total;
    }
  }
  return smallest;
}

/** VRAM budget for planner/validation: placement targets when set, else smallest online GPU pool. */
export function resolvePlacementVramMb(
  deployment: DeploymentConfig,
  config: ApplianceConfig,
  gpusPerInstance: number,
): number | null {
  const targets = deployment.placement?.targets ?? [];
  if (targets.length > 0) {
    let smallest: number | null = null;
    for (const target of targets) {
      const node = config.nodes.find((item) => item.id === target.node_id);
      if (!node) continue;
      const total = target.gpu_indices.reduce(
        (sum, index) => sum + (node.gpus.find((gpu) => gpu.index === index)?.vram_mb ?? 0),
        0,
      );
      if (total > 0 && (smallest === null || total < smallest)) {
        smallest = total;
      }
    }
    if (smallest !== null) return smallest;
  }
  return smallestOnlineGpuVramMb(config, gpusPerInstance);
}