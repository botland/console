'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import {
  buildConsoleContext,
  modeLabel,
  roleLabel,
  type ConsoleContext,
} from '@/lib/console-capabilities';

export function ApplianceIdentityBar() {
  const [ctx, setCtx] = useState<ConsoleContext | null>(null);

  useEffect(() => {
    api
      .status()
      .then((status) => {
        if (!status.gateway || !status.config?.cluster) {
          setCtx(null);
          return;
        }
        setCtx(buildConsoleContext(status.gateway, status.config.cluster));
      })
      .catch(() => setCtx(null));
  }, []);

  if (!ctx) return null;

  const nodeId = ctx.gateway.local_node_id;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{nodeId}</span>
      <span className="text-slate-600">·</span>
      <span className="text-cyan-400/90">{roleLabel(ctx)}</span>
      <span className="text-slate-600">·</span>
      <span>{modeLabel(ctx)}</span>
    </div>
  );
}