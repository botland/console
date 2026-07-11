import type { NodeConfig } from '@/lib/types';

export function validateNodeAddresses(nodes: NodeConfig[]): string | null {
  const byIp = new Map<string, string>();
  const byHostname = new Map<string, string>();

  for (const node of nodes) {
    const ip = node.ip.trim();
    if (ip) {
      const other = byIp.get(ip);
      if (other) {
        return `Duplicate node IP ${ip} (${other} and ${node.id})`;
      }
      byIp.set(ip, node.id);
    }

    const hostname = node.hostname.trim();
    if (!hostname) {
      return `Node ${node.ip.trim() || node.id} requires a hostname`;
    }
    const other = byHostname.get(hostname);
    if (other) {
      return `Duplicate hostname ${hostname} (${other} and ${node.id})`;
    }
    byHostname.set(hostname, node.id);
  }

  return null;
}

export function mergeNodeDraft(node: NodeConfig, draft: Partial<NodeConfig>): NodeConfig {
  return {
    ...node,
    ...draft,
    id: node.id,
    labels: draft.labels ?? node.labels,
  };
}