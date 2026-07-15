'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Shield } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CapabilitiesResponse, CapabilityPack } from '@/lib/types';

function HealthDot({ status }: { status: string }) {
  const color =
    status === 'up'
      ? 'bg-emerald-400'
      : status === 'down'
        ? 'bg-rose-400'
        : 'bg-slate-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={status} />;
}

export default function PacksPage() {
  const [data, setData] = useState<CapabilitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .listCapabilities()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load capability packs');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (cap: CapabilityPack) => {
    setBusyId(cap.id);
    setError(null);
    try {
      const updated = await api.setCapabilityEnabled(cap.id, !cap.enabled);
      setData((prev) =>
        prev
          ? {
              ...prev,
              capabilities: prev.capabilities.map((c) => (c.id === updated.id ? updated : c)),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update pack');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {data && (
        <>
          <PageHeader
            title="Capability packs"
            description="Read-only MCP tools exposed through head LiteLLM. Enable only what you have configured."
          />

          {!data.mcp_enabled && (
            <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm text-amber-200/90">
                MCP is disabled (<code className="text-amber-100">ENABLE_MCP=false</code>). Packs
                will not be registered on LiteLLM until MCP is turned on.
              </p>
            </Card>
          )}

          <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/80" />
            <p>
              All packs are <strong className="text-slate-300">read-only</strong>. Write/delete tools
              are not registered. Connector packs stay off by default until you enable them here
              after mounting credentials or repos.
            </p>
          </div>

          <div className="space-y-4">
            {data.capabilities.map((cap) => (
              <Card key={cap.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-cyan-400/80" />
                      <h3 className="font-medium text-slate-100">{cap.id}</h3>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {cap.pack} v{cap.pack_version}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <HealthDot status={cap.health?.status ?? 'unknown'} />
                        MCP {cap.health?.status ?? 'unknown'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{cap.description}</p>
                  </div>
                  <Button
                    variant={cap.enabled ? 'secondary' : 'primary'}
                    disabled={busyId === cap.id}
                    onClick={() => toggle(cap)}
                  >
                    {busyId === cap.id ? 'Saving…' : cap.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>

                <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-400">Tools: </span>
                    {(cap.allowed_tools || []).join(', ') || '—'}
                  </div>
                  <div>
                    <span className="text-slate-400">Backend: </span>
                    {cap.configured ? (
                      <span className="text-emerald-400/90">configured</span>
                    ) : (
                      <span className="text-amber-400/90">needs setup</span>
                    )}
                    {cap.configured_detail ? ` — ${cap.configured_detail}` : ''}
                  </div>
                </div>

                {cap.docs && (
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                    {cap.docs.trim()}
                  </pre>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </PageState>
  );
}
