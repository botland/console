/** Customer-facing node label: hostname and IP (never internal node_id). */
export function formatNodeLabel(hostname: string, ip: string): string {
  const host = hostname.trim();
  const addr = ip.trim();
  if (host && addr) return `${host} (${addr})`;
  if (host) return host;
  if (addr) return addr;
  return 'unknown node';
}

export function formatNodeLabelFromNode(node: {
  hostname: string;
  ip: string;
}): string {
  return formatNodeLabel(node.hostname, node.ip);
}