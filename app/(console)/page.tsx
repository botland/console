'use client';

import { useEffect, useState } from 'react';

import { GpuBar } from '@/components/GpuBar';
import { ApplianceBadge } from '@/components/StatusBadge';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { ApplianceConfig, ApplianceStatus } from '@/lib/types';

export default function OverviewPage() {
  const [status, setStatus] = useState<(ApplianceStatus & { config: ApplianceConfig }) | null>(null);

  useEffect(() => {
    const load = () => api.status().then(setStatus).catch(console.error);
    load();
    const id = setInterval(load, 5000);
    const es = new EventSource('/api/v1/ws');
    es.onmessage = () => load();
    return () => {
      clearInterval(id);
      es.close();
    };
  }, []);

  if (!status) {
    return <div className="text-slate-500">Loading appliance status…</div>;
  }

  const { config } = status;
  const enabledDeps = config.deployments.filter((d) => d.enabled);
  const totalGpus = config.nodes.reduce((s, n) => s + n.gpus.length, 0);
  const modeLabel =
    config.cluster.serving_mode === 'distributed' ? 'Distributed' : 'Standalone';
  const headNode = config.nodes.find((n) => n.is_head);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Appliance ${config.appliance_id} · Head: ${headNode?.hostname ?? 'unknown'}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="text-xs text-slate-500 mb-2">State</div>
          <ApplianceBadge state={status.state} />
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Serving topology</div>
          <div className="text-sm font-medium text-cyan-400">{modeLabel}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Active deployments</div>
          <div className="text-2xl font-display font-semibold text-slate-100">
            {enabledDeps.length}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Total GPUs</div>
          <div className="text-2xl font-display font-semibold text-slate-100">
            {totalGpus}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            GPU utilization
          </h2>
          <div className="space-y-4">
            {config.nodes.map((node) => (
              <div key={node.id}>
                <div className="text-xs font-medium text-slate-400 mb-2">
                  {node.hostname} ({node.ip})
                  {node.is_head && (
                    <span className="ml-2 text-cyan-400/80">· head</span>
                  )}
                </div>
                <div className="space-y-2 pl-2">
                  {node.gpus.map((gpu) => (
                    <GpuBar
                      key={gpu.index}
                      name={gpu.name}
                      utilization={gpu.utilization_pct ?? 0}
                      vramMb={gpu.vram_mb}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            Recent events
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {status.events.map((evt) => (
              <div
                key={evt.id}
                className="flex gap-3 text-sm border-b border-slate-800/50 pb-2 last:border-0"
              >
                <span className="text-slate-500 shrink-0 text-xs">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={
                    evt.level === 'error'
                      ? 'text-red-400'
                      : evt.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                  }
                >
                  {evt.message}
                </span>
              </div>
            ))}
          </div>
          {status.last_error && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
              {status.last_error}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}