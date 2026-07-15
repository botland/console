'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, Shield } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CapabilitiesResponse, CapabilityPack, PlatformSnapshot, RagConfig } from '@/lib/types';

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
  const [platform, setPlatform] = useState<PlatformSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tenantDraft, setTenantDraft] = useState('default');
  const [ragDraft, setRagDraft] = useState<RagConfig | null>(null);
  const [savingPlatform, setSavingPlatform] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([api.listCapabilities(), api.getPlatform()])
      .then(([caps, plat]) => {
        setData(caps);
        setPlatform(plat);
        setTenantDraft(plat.tenant_id);
        setRagDraft(plat.rag);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load packs / platform');
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
      const updated = await api.setCapabilityEnabled(cap.id, !cap.enabled, {
        access_mode: 'ro',
      });
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

  const saveTenant = async () => {
    setSavingPlatform(true);
    setError(null);
    try {
      const snap = await api.putPlatformTenant(tenantDraft.trim() || 'default');
      setPlatform(snap);
      setRagDraft(snap.rag);
      setData((prev) => (prev ? { ...prev, tenant_id: snap.tenant_id } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save tenant');
    } finally {
      setSavingPlatform(false);
    }
  };

  const saveRag = async () => {
    if (!ragDraft) return;
    setSavingPlatform(true);
    setError(null);
    try {
      const snap = await api.putPlatformRag({
        ...ragDraft,
        tenant_id: tenantDraft.trim() || ragDraft.tenant_id || 'default',
      });
      setPlatform(snap);
      setRagDraft(snap.rag);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save RAG config');
    } finally {
      setSavingPlatform(false);
    }
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {data && (
        <>
          <PageHeader
            title="Capability packs"
            description="Read-only MCP tools via head LiteLLM. Tenant, RAG versions, and RW grant stubs live here for productization."
          />

          {platform && (
            <Card className="mb-6 space-y-4">
              <div className="text-sm font-medium text-slate-200">Platform (tenant-ready)</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Tenant ID</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={tenantDraft}
                      onChange={(e) => setTenantDraft(e.target.value)}
                      placeholder="default"
                    />
                    <Button variant="secondary" disabled={savingPlatform} onClick={saveTenant}>
                      Save
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Propagates to retrieval/MCP contracts. SSO can override via{' '}
                    <code className="text-slate-400">X-Tenant-Id</code>.
                  </p>
                </div>
                <div>
                  <Label>Agent runtime</Label>
                  <p className="mt-2 text-sm text-slate-300">
                    <code className="text-cyan-400/90">{platform.agent_runtime}</code>
                    <span className="ml-2 text-xs text-slate-500">
                      (v1 ships None — no LangGraph dependency)
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    RW packs: {platform.allow_rw_capabilities ? 'env allowed' : 'blocked'} · SSO:{' '}
                    {platform.acl.sso_enabled ? 'on' : 'off'}
                  </p>
                </div>
              </div>
              {ragDraft && (
                <div className="grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-3">
                  <div>
                    <Label>Embedding model id</Label>
                    <Input
                      className="mt-1"
                      value={ragDraft.embedding_model_id}
                      onChange={(e) =>
                        setRagDraft({ ...ragDraft, embedding_model_id: e.target.value })
                      }
                      placeholder="embedding"
                    />
                  </div>
                  <div>
                    <Label>Chunker version</Label>
                    <Input
                      className="mt-1"
                      value={ragDraft.chunker_version}
                      onChange={(e) =>
                        setRagDraft({ ...ragDraft, chunker_version: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Default corpus</Label>
                    <Input
                      className="mt-1"
                      value={ragDraft.default_corpus_id}
                      onChange={(e) =>
                        setRagDraft({ ...ragDraft, default_corpus_id: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Button variant="secondary" disabled={savingPlatform} onClick={saveRag}>
                      Save RAG config (versioned)
                    </Button>
                    {platform.versions.length > 0 && (
                      <span className="ml-3 text-xs text-slate-500">
                        Last change: {platform.versions[0]?.kind} @ {platform.versions[0]?.version}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

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
              All shipped packs are <strong className="text-slate-300">read-only</strong>. RW grant
              stubs exist for future tools; they require{' '}
              <code className="text-slate-400">ALLOW_RW_CAPABILITIES</code>, admin ack, HITL, and
              rollback before any write tools can be registered.
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
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-emerald-400/80">
                        {(cap.access_modes || ['ro']).join('/')}
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
