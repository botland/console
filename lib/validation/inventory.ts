import type { ApplianceConfig, ClusterInventory } from '@/lib/types';

export function buildInventory(config: ApplianceConfig): ClusterInventory {
  const onlineNodes = config.nodes.filter((n) => n.status === 'online');
  const head = config.nodes.find((n) => n.id === config.cluster.head_node_id);

  let total = 0;
  let available = 0;
  let maxPerNode = 0;

  for (const node of onlineNodes) {
    const nodeTotal = node.gpus.length;
    const reserved = Math.min(node.gpus_reserved_for_system, nodeTotal);
    const nodeAvailable = Math.max(0, nodeTotal - reserved);
    total += nodeTotal;
    available += nodeAvailable;
    maxPerNode = Math.max(maxPerNode, nodeAvailable);
  }

  return {
    total_gpu_count: total,
    available_gpu_count: available,
    max_gpus_per_node: Math.max(1, maxPerNode),
    online_node_count: onlineNodes.length,
    head_online: head?.status === 'online',
  };
}