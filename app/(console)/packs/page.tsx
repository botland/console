'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Package, Shield } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  COMING_SOON_CONNECTORS,
  CONNECTOR_DEFS,
  SECTION_META,
  connectionStatus,
  enableConfirmMessage,
  statusDotClass,
  statusLabel,
  trustLabel,
  trustTone,
  unmappedCapabilities,
  type ConnectorDef,
  type PermissionMeta,
  type ConnectorSection,
} from '@/lib/connectors';
import type {
  CapabilitiesResponse,
  CapabilityPack,
  PendingChange,
  PlatformSnapshot,
  RagConfig,
} from '@/lib/types';

function packById(data: CapabilitiesResponse | null, id: string): CapabilityPack | undefined {
  return data?.capabilities.find((c) => c.id === id);
}

export default function PacksPage() {
  const [data, setData] = useState<CapabilitiesResponse | null>(null);
  const [platform, setPlatform] = useState<PlatformSnapshot | null>(null);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState<string | null>(null);
  const [tenantDraft, setTenantDraft] = useState('default');
  const [ragDraft, setRagDraft] = useState<RagConfig | null>(null);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [expandedTech, setExpandedTech] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.listCapabilities(),
      api.getPlatform(),
      api.listPendingChanges('pending').catch(() => ({ mutations: [] as PendingChange[], count: 0 })),
    ])
      .then(([caps, plat, muts]) => {
        setData(caps);
        setPlatform(plat);
        setTenantDraft(plat.tenant_id);
        setRagDraft(plat.rag);
        setPending(muts.mutations ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load sources / platform');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePermission = async (permission: PermissionMeta, cap: CapabilityPack) => {
    if (!cap.enabled) {
      const msg = enableConfirmMessage(permission);
      if (msg && typeof window !== 'undefined' && !window.confirm(msg)) {
        return;
      }
    }
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
      setError(e instanceof ApiError ? e.message : 'Failed to update source');
    } finally {
      setBusyId(null);
    }
  };

  const applyChange = async (m: PendingChange) => {
    const isHighImpact =
      m.capability_id === 'knowledge.propose_archive' ||
      (m.title || '').toLowerCase().includes('archive') ||
      (m.summary || '').toLowerCase().includes('trash');
    if (
      isHighImpact &&
      typeof window !== 'undefined' &&
      !window.confirm('Apply this high-impact change? You can usually roll back from staging, but review carefully.')
    ) {
      return;
    }
    setMutationBusy(m.mutation_id);
    setError(null);
    try {
      await api.applyPendingChange(m.mutation_id, {
        preview_checksum: m.preview_checksum,
        ack: 'Apply',
      });
      setPending((prev) => prev.filter((x) => x.mutation_id !== m.mutation_id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to apply changes');
    } finally {
      setMutationBusy(null);
    }
  };

  const discardChange = async (m: PendingChange) => {
    setMutationBusy(m.mutation_id);
    setError(null);
    try {
      await api.discardPendingChange(m.mutation_id);
      setPending((prev) => prev.filter((x) => x.mutation_id !== m.mutation_id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to discard changes');
    } finally {
      setMutationBusy(null);
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
      setError(e instanceof ApiError ? e.message : 'Failed to save knowledge settings');
    } finally {
      setSavingPlatform(false);
    }
  };

  const sections = useMemo(() => {
    const order: ConnectorSection[] = ['builtin', 'apps', 'advanced'];
    return order
      .map((section) => ({
        section,
        connectors: CONNECTOR_DEFS.filter((c) => {
          if (c.section !== section) return false;
          if (c.advancedOnly && !developerMode) return false;
          return true;
        }),
      }))
      .filter((g) => g.connectors.length > 0);
  }, [developerMode]);

  const orphanCaps = useMemo(
    () => (data ? unmappedCapabilities(data.capabilities) : []),
    [data],
  );

  const renderConnector = (connector: ConnectorDef) => {
    const packs = data?.capabilities ?? [];
    const status = connectionStatus(packs, connector);
    const techOpen = expandedTech[connector.id] ?? false;

    return (
      <Card key={connector.id} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400/80" />
              <h3 className="font-medium text-slate-100">{connector.displayName}</h3>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-300">
                <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(status)}`} />
                {statusLabel(status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{connector.summary}</p>
            {connector.roadmapNote && (
              <p className="mt-1 text-xs text-slate-500">{connector.roadmapNote}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {connector.permissions.map((permission) => {
            const cap = packById(data, permission.capabilityId);
            if (!cap) {
              return (
                <div
                  key={permission.capabilityId}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-500"
                >
                  {permission.label} — not available on this appliance build
                </div>
              );
            }
            return (
              <div
                key={permission.capabilityId}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{permission.label}</span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs ${trustTone(permission.trust)}`}
                      >
                        {trustLabel(permission.trust)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{permission.description}</p>
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                      {permission.canDo.map((line) => (
                        <li key={line} className="flex gap-1.5">
                          <span className="text-emerald-500/80">✓</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    {permission.trust === 'read' && (
                      <p className="pt-1 text-xs font-medium text-emerald-400/80">
                        Read-only access. Your data is never changed.
                      </p>
                    )}
                    {(permission.trust === 'propose' || permission.trust === 'high_impact') && (
                      <p className="pt-1 text-xs font-medium text-amber-300/80">
                        Suggestions require your approval before anything changes.
                      </p>
                    )}
                  </div>
                  <Button
                    variant={cap.enabled ? 'secondary' : 'primary'}
                    disabled={busyId === cap.id}
                    onClick={() => togglePermission(permission, cap)}
                  >
                    {busyId === cap.id ? 'Saving…' : cap.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
            onClick={() =>
              setExpandedTech((prev) => ({ ...prev, [connector.id]: !techOpen }))
            }
          >
            {techOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Technical details
          </button>
          {techOpen && (
            <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
              {connector.permissions.map((permission) => {
                const cap = packById(data, permission.capabilityId);
                if (!cap) return null;
                return (
                  <div key={cap.id} className="space-y-1 border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="text-slate-400">Capability id: </span>
                      <code className="text-slate-400">{cap.id}</code>
                    </div>
                    <div>
                      <span className="text-slate-400">Pack: </span>
                      {cap.pack} v{cap.pack_version}
                    </div>
                    <div>
                      <span className="text-slate-400">Tools: </span>
                      {(cap.allowed_tools || []).join(', ') || '—'}
                    </div>
                    <div>
                      <span className="text-slate-400">Backend: </span>
                      {cap.configured ? 'configured' : 'needs setup'}
                      {cap.configured_detail ? ` — ${cap.configured_detail}` : ''}
                    </div>
                    {cap.docs && (
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-slate-600">
                        {cap.docs.trim()}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {data && (
        <>
          <PageHeader
            title="Information sources"
            description="Choose which systems the AI may use to answer questions. Enable a source when it is ready—read access works immediately; anything that changes data needs your approval."
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400 sm:flex-1">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/80" />
              <p>
                <strong className="text-slate-300">Read-only by default.</strong> The AI cannot
                modify your data unless you enable a permission that prepares changes—and those
                always wait for your approval.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                checked={developerMode}
                onChange={(e) => setDeveloperMode(e.target.checked)}
              />
              Developer mode
            </label>
          </div>

          {pending.length > 0 && (
            <Card className="mb-6 space-y-3 border-amber-500/25 bg-amber-500/5">
              <div className="text-sm font-medium text-slate-100">Pending approvals</div>
              <p className="text-xs text-slate-500">
                The AI prepared these changes. Nothing is applied until you review and confirm.
              </p>
              <div className="space-y-3">
                {pending.map((m) => (
                  <div
                    key={m.mutation_id}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-200">
                          {m.title || m.summary || 'Proposed changes'}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {m.preview_text || m.summary || 'Review before applying'}
                        </p>
                        {m.preview &&
                        typeof m.preview === 'object' &&
                        m.preview !== null &&
                        'items' in m.preview &&
                        Array.isArray((m.preview as { items?: unknown[] }).items) ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {`${(m.preview as { items: unknown[] }).items.length} item(s)`}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          disabled={mutationBusy === m.mutation_id}
                          onClick={() => discardChange(m)}
                        >
                          {mutationBusy === m.mutation_id ? '…' : 'Discard'}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={mutationBusy === m.mutation_id}
                          onClick={() => applyChange(m)}
                        >
                          {mutationBusy === m.mutation_id ? '…' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {!data.mcp_enabled && developerMode && (
            <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm text-amber-200/90">
                Tool gateway is disabled on this appliance (
                <code className="text-amber-100">ENABLE_MCP=false</code>). Sources will not
                expose tools until it is turned on.
              </p>
            </Card>
          )}

          <div className="space-y-8">
            {sections.map(({ section, connectors }) => (
              <section key={section} className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    {SECTION_META[section].title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{SECTION_META[section].description}</p>
                </div>
                <div className="space-y-4">{connectors.map(renderConnector)}</div>
              </section>
            ))}

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Coming soon
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Document suites and more databases—Microsoft 365, Atlassian, Google, MySQL, LDAP.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMING_SOON_CONNECTORS.map((c) => (
                  <Card key={c.id} className="space-y-1 opacity-80">
                    <div className="text-sm font-medium text-slate-300">{c.displayName}</div>
                    <p className="text-xs text-slate-500">{c.summary}</p>
                    <span className="inline-block pt-1 text-xs text-slate-600">Not available yet</span>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {developerMode && platform && (
            <Card className="mt-8 space-y-4 border-slate-700/80">
              <div className="text-sm font-medium text-slate-200">Platform (developer)</div>
              <p className="text-xs text-slate-500">
                Tenant, retrieval, and runtime settings. Hidden from the default sources view.
              </p>
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
                </div>
                <div>
                  <Label>AI runtime</Label>
                  <p className="mt-2 text-sm text-slate-300">
                    Built-in
                    {platform.agent_runtime && platform.agent_runtime !== 'none' ? (
                      <span className="ml-2 text-xs text-slate-500">({platform.agent_runtime})</span>
                    ) : (
                      <span className="ml-2 text-xs text-slate-500">(standard)</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Write sources:{' '}
                    {platform.allow_rw_capabilities ? 'environment allows' : 'blocked by policy'} ·
                    Single sign-on: {platform.acl.sso_enabled ? 'on' : 'off'}
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
                      Save knowledge settings
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

          {developerMode && orphanCaps.length > 0 && (
            <Card className="mt-4 space-y-2 border-slate-700/80">
              <div className="text-sm font-medium text-slate-200">Unmapped capabilities</div>
              <p className="text-xs text-slate-500">
                Internal packs on the controller without a source presentation.
              </p>
              <ul className="space-y-1 text-xs text-slate-400">
                {orphanCaps.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code> — {c.description}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </PageState>
  );
}
