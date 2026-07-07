'use client';

import { useCallback, useEffect, useState } from 'react';

import { GpuBar } from '@/components/GpuBar';
import { PageError, PageLoading } from '@/components/PageState';
import { ApplianceBadge } from '@/components/StatusBadge';
import { Card, PageHeader } from '@/components/ui';
import { effectiveApplianceState, hasDegradedSignals } from '@/lib/appliance-status';
import { api, ApiError } from '@/lib/api';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import type { ApplianceConfig, ApplianceStatus } from '@/lib/types';

type OverviewData = ApplianceStatus & {
  config: ApplianceConfig | null;
  config_error?: string;
};

export default function OverviewPage() {
  const [status, setStatus] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return api
      .status()
      .then(setStatus)
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load appliance status');
        console.error(e);
      });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    const es = new EventSource('/api/v1/ws');
    es.onmessage = () => load();
    return () => {
      clearInterval(id);
      es.close();
    };
  }, [load]);

  if (error && !status) {
    return <PageError error={error} onRetry={load} />;
  }

  if (!status) {
    return <PageLoading message="Loading appliance status…" />;
  }

  const { config } = status;
  const enabledDeps = config?.deployments.filter((d) => d.enabled) ?? [];
  const totalGpus = config?.nodes.reduce((s, n) => s + n.gpus.length, 0) ?? 0;
  const modeLabel =
    config?.cluster.serving_mode === 'distributed' ? 'Distributed' : config ? 'Standalone' : '—';
  const headNode = config?.nodes.find((n) => n.is_head);
  const degradedSignals = hasDegradedSignals(status, config);

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          config
            ? `Appliance ${config.appliance_id} · Head: ${
                headNode ? formatNodeLabelFromNode(headNode) : 'unknown'
              }`
            : `Head: ${status.head.head_ip || 'unknown'}`
        }
      />

      {status.config_error && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Configuration unavailable: {status.config_error}
        </div>
      )}

      {degradedSignals && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <p className="mb-1 font-medium text-amber-200">Runtime warning</p>
          {status.actual?.exit_code != null && status.actual.exit_code !== 0 && (
            <p className="mb-1">Process exited with code {status.actual.exit_code}.</p>
          )}
          {status.actual?.log_snippet && (
            <pre className="whitespace-pre-wrap text-xs text-amber-200/90 font-mono">
              {status.actual.log_snippet}
            </pre>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="text-xs text-slate-500 mb-2">State</div>
          <ApplianceBadge state={effectiveApplianceState(status, config)} />
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Serving topology</div>
          <div className="text-sm font-medium text-cyan-400">{modeLabel}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Active deployments</div>
          <div className="text-2xl font-display font-semibold text-slate-100">
            {config ? enabledDeps.length : '—'}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 mb-2">Total GPUs</div>
          <div className="text-2xl font-display font-semibold text-slate-100">
            {config ? totalGpus : '—'}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {config ? (
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
        ) : (
          <Card className="text-sm text-slate-500">
            GPU utilization unavailable until configuration loads.
          </Card>
        )}

        <Card>
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            Recent events
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {status.events.length === 0 ? (
              <p className="text-sm text-slate-500">No recent events.</p>
            ) : (
              status.events.map((evt) => (
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
              ))
            )}
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