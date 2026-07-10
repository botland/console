'use client';

import {
  buildConsoleContext,
  modeLabel,
  roleLabel,
} from '@/lib/console-capabilities';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import { useApplianceStatus } from '@/lib/status-context';

export function ApplianceIdentityBar() {
  const { status } = useApplianceStatus();

  if (!status?.gateway || !status.config?.cluster) {
    return null;
  }

  const ctx = buildConsoleContext(status.gateway, status.config.cluster);
  const localNode = status.config.nodes.find((n) => n.id === status.gateway?.local_node_id);
  const nodeLabel = localNode ? formatNodeLabelFromNode(localNode) : null;

  if (!nodeLabel) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{nodeLabel}</span>
      <span className="text-slate-600">·</span>
      <span className="text-cyan-400/90">{roleLabel(ctx)}</span>
      <span className="text-slate-600">·</span>
      <span>{modeLabel(ctx)}</span>
    </div>
  );
}