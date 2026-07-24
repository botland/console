'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Package,
  Plus,
  Settings2,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  COMING_SOON_CONNECTORS,
  DEFAULT_GROUP_OPTIONS,
  SOURCE_TYPES,
  SECTION_META,
  configSummary,
  createInstance,
  enableConfirmMessage,
  getSourceType,
  instanceConfigComplete,
  instanceStatus,
  loadStoredInstances,
  mergeInstancesWithPacks,
  normalizeSourceInstance,
  saveStoredInstances,
  sourceInstanceToWriteBody,
  statusDotClass,
  statusLabel,
  trustLabel,
  trustTone,
  unmappedCapabilities,
  type PermissionTemplate,
  type SourceInstance,
  type SourceSection,
  type SourceTypeDef,
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
  const [instances, setInstances] = useState<SourceInstance[]>([]);
  /** When true, CRUD goes to controller /sources (Phase 3 registry). */
  const [useServerRegistry, setUseServerRegistry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState<string | null>(null);
  const [tenantDraft, setTenantDraft] = useState('default');
  const [ragDraft, setRagDraft] = useState<RagConfig | null>(null);
  const [ragHealth, setRagHealth] = useState<import('@/lib/types').RagHealthResponse | null>(null);
  const [ragSaveWarning, setRagSaveWarning] = useState<string | null>(null);
  const [reindexStatus, setReindexStatus] = useState<string | null>(null);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configOpenId, setConfigOpenId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [draftConfigs, setDraftConfigs] = useState<Record<string, Record<string, string>>>({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const persist = useCallback(
    (next: SourceInstance[]) => {
      setInstances(next);
      if (!useServerRegistry) {
        saveStoredInstances(next);
      }
    },
    [useServerRegistry],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.listCapabilities(),
      api.getPlatform(),
      api.listPendingChanges('pending').catch(() => ({ mutations: [] as PendingChange[], count: 0 })),
      api.listSources().catch(() => null),
      api.getPlatformRagHealth().catch(() => null),
    ])
      .then(([caps, plat, muts, sourcesResp, health]) => {
        setData(caps);
        setPlatform(plat);
        setTenantDraft(plat.tenant_id);
        setRagDraft(plat.rag);
        setRagHealth(health);
        setPending(muts.mutations ?? []);
        if (sourcesResp && Array.isArray(sourcesResp.sources)) {
          setUseServerRegistry(true);
          setInstances(
            sourcesResp.sources.map((s) =>
              normalizeSourceInstance(s as unknown as Record<string, unknown>),
            ),
          );
        } else {
          setUseServerRegistry(false);
          const merged = mergeInstancesWithPacks(loadStoredInstances(), caps.capabilities);
          setInstances(merged);
        }
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

  const togglePermission = async (
    instance: SourceInstance,
    permission: PermissionTemplate,
  ) => {
    const type = getSourceType(instance.typeId);
    if (!type) return;

    const isEnabling = !instance.enabledPermissionIds.includes(permission.id);
    if (isEnabling) {
      const msg = enableConfirmMessage(permission);
      if (msg && typeof window !== 'undefined' && !window.confirm(msg)) {
        return;
      }
    }

    // Policy-only instances (extra multi-instance rows) or server registry without pack bridge
    if (!instance.packBound || !permission.capabilityId) {
      const nextIds = isEnabling
        ? [...instance.enabledPermissionIds, permission.id]
        : instance.enabledPermissionIds.filter((id) => id !== permission.id);
      const updatedLocal = {
        ...instance,
        enabledPermissionIds: nextIds,
        updatedAt: new Date().toISOString(),
      };
      if (useServerRegistry) {
        setBusyKey(`${instance.id}:${permission.id}`);
        setError(null);
        try {
          const saved = await api.patchSource(instance.id, {
            enabledPermissionIds: nextIds,
          });
          const normalized = normalizeSourceInstance(saved as unknown as Record<string, unknown>);
          persist(instances.map((i) => (i.id === instance.id ? normalized : i)));
        } catch (e) {
          setError(e instanceof ApiError ? e.message : 'Failed to update source permissions');
        } finally {
          setBusyKey(null);
        }
        return;
      }
      persist(instances.map((i) => (i.id === instance.id ? updatedLocal : i)));
      return;
    }

    const cap = packById(data, permission.capabilityId);
    if (!cap) {
      setError('This permission is not available on this appliance build.');
      return;
    }

    // Require configuration before enabling agent access (console form or pack already configured)
    const mergedConfig = { ...instance.config, ...draftConfigs[instance.id] };
    const packAlreadyConfigured = Boolean(
      permission.capabilityId && packById(data, permission.capabilityId)?.configured,
    );
    if (
      isEnabling &&
      !instanceConfigComplete(type, mergedConfig) &&
      !packAlreadyConfigured &&
      type.configFields.length > 0
    ) {
      setError(
        'Configure this source before enabling permissions. Connection settings belong in the console—not a shared .env.',
      );
      setConfigOpenId(instance.id);
      setExpandedId(instance.id);
      return;
    }

    setBusyKey(`${instance.id}:${permission.id}`);
    setError(null);
    try {
      const updated = await api.setCapabilityEnabled(cap.id, isEnabling, {
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
      const nextIds = isEnabling
        ? [...new Set([...instance.enabledPermissionIds, permission.id])]
        : instance.enabledPermissionIds.filter((id) => id !== permission.id);
      if (useServerRegistry) {
        try {
          const saved = await api.patchSource(instance.id, {
            enabledPermissionIds: nextIds,
          });
          const normalized = normalizeSourceInstance(saved as unknown as Record<string, unknown>);
          persist(instances.map((i) => (i.id === instance.id ? normalized : i)));
        } catch {
          // Pack enablement succeeded; keep local permission state if registry patch fails
          persist(
            instances.map((i) =>
              i.id === instance.id
                ? { ...i, enabledPermissionIds: nextIds, updatedAt: new Date().toISOString() }
                : i,
            ),
          );
        }
      } else {
        persist(
          instances.map((i) =>
            i.id === instance.id
              ? { ...i, enabledPermissionIds: nextIds, updatedAt: new Date().toISOString() }
              : i,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update permission');
    } finally {
      setBusyKey(null);
    }
  };

  const applyChange = async (m: PendingChange) => {
    const isHighImpact =
      m.capability_id === 'corpus.propose_archive' ||
      m.capability_id === 'knowledge.propose_archive' ||
      (m.title || '').toLowerCase().includes('archive') ||
      (m.summary || '').toLowerCase().includes('trash');
    if (
      isHighImpact &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Apply this high-impact change? You can usually roll back from staging, but review carefully.',
      )
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
    setRagSaveWarning(null);
    try {
      const snap = await api.putPlatformRag({
        ...ragDraft,
        tenant_id: tenantDraft.trim() || ragDraft.tenant_id || 'default',
      });
      setPlatform(snap);
      setRagDraft(snap.rag);
      if (snap.warning || snap.retrieval_sync?.ok === false) {
        setRagSaveWarning(
          snap.warning ||
            'Saved locally; retrieval was not updated. Check retrieval service and re-save.',
        );
      }
      try {
        setRagHealth(await api.getPlatformRagHealth());
      } catch {
        /* checklist optional */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save knowledge settings');
    } finally {
      setSavingPlatform(false);
    }
  };

  const runReindex = async () => {
    const ok = window.confirm(
      'This deletes the vector collection and re-embeds the entire RO corpus with the current embedding model. Continue?',
    );
    if (!ok) return;
    setReindexing(true);
    setError(null);
    setReindexStatus(null);
    try {
      const result = await api.reindexCorpus({
        tenant_id: tenantDraft.trim() || ragDraft?.tenant_id || 'default',
        corpus_id: ragDraft?.default_corpus_id || 'appliance',
      });
      const docs = result.documents ?? 0;
      const chunks = result.chunks ?? 0;
      const errs = result.errors?.length ?? 0;
      setReindexStatus(
        `Reindex finished: ${docs} documents, ${chunks} chunks` +
          (errs ? ` (${errs} file errors)` : ''),
      );
      try {
        setRagHealth(await api.getPlatformRagHealth());
      } catch {
        /* optional */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Reindex failed');
    } finally {
      setReindexing(false);
    }
  };

  const addInstance = async (type: SourceTypeDef) => {
    if (!type.multiInstance) {
      const existing = instances.find((i) => i.typeId === type.id);
      if (existing) {
        setExpandedId(existing.id);
        setAddMenuOpen(false);
        return;
      }
    }

    // First instance of a pack-backed type can bind if no pack-bound exists yet
    const hasPackBound = instances.some((i) => i.typeId === type.id && i.packBound);
    const packBound =
      type.singletonBuiltin ||
      (!hasPackBound && type.permissions.some((p) => p.capabilityId && packById(data, p.capabilityId)));

    const inst = createInstance(type, {
      displayName: type.multiInstance
        ? `${type.displayName} ${instances.filter((i) => i.typeId === type.id).length + 1}`
        : type.displayName,
      packBound: Boolean(packBound),
    });
    if (useServerRegistry) {
      setError(null);
      try {
        const saved = await api.createSource(sourceInstanceToWriteBody(inst));
        const normalized = normalizeSourceInstance(saved as unknown as Record<string, unknown>);
        persist([...instances, normalized]);
        setExpandedId(normalized.id);
        setConfigOpenId(normalized.id);
        setDraftConfigs((d) => ({ ...d, [normalized.id]: { ...normalized.config } }));
        setDraftNames((d) => ({ ...d, [normalized.id]: normalized.displayName }));
        setAddMenuOpen(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to create source on appliance');
      }
      return;
    }
    const next = [...instances, inst];
    persist(next);
    setExpandedId(inst.id);
    setConfigOpenId(inst.id);
    setDraftConfigs((d) => ({ ...d, [inst.id]: { ...inst.config } }));
    setDraftNames((d) => ({ ...d, [inst.id]: inst.displayName }));
    setAddMenuOpen(false);
  };

  const removeInstance = async (instance: SourceInstance) => {
    const type = getSourceType(instance.typeId);
    if (type?.singletonBuiltin) {
      setError('Built-in appliance knowledge cannot be removed.');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Remove source “${instance.displayName}”? Configuration on this console will be discarded.`)
    ) {
      return;
    }
    if (useServerRegistry) {
      setError(null);
      try {
        await api.deleteSource(instance.id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to remove source');
        return;
      }
    }
    persist(instances.filter((i) => i.id !== instance.id));
    if (expandedId === instance.id) setExpandedId(null);
  };

  const saveInstanceConfig = async (instance: SourceInstance) => {
    const type = getSourceType(instance.typeId);
    if (!type) return;
    const config = draftConfigs[instance.id] ?? instance.config;
    const displayName = (draftNames[instance.id] ?? instance.displayName).trim() || type.displayName;
    if (!instanceConfigComplete(type, config)) {
      setError('Fill in all required connection fields before saving.');
      return;
    }
    setError(null);
    if (useServerRegistry) {
      try {
        const saved = await api.patchSource(instance.id, { displayName, config });
        const normalized = normalizeSourceInstance(saved as unknown as Record<string, unknown>);
        persist(instances.map((i) => (i.id === instance.id ? normalized : i)));
        setConfigOpenId(null);
        return;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to save source config');
        return;
      }
    }
    persist(
      instances.map((i) =>
        i.id === instance.id
          ? {
              ...i,
              displayName,
              config,
              updatedAt: new Date().toISOString(),
            }
          : i,
      ),
    );
    setConfigOpenId(null);
  };

  const toggleGroup = async (instance: SourceInstance, group: string) => {
    const has = instance.groups.includes(group);
    const groups = has
      ? instance.groups.filter((g) => g !== group)
      : [...instance.groups, group];
    if (groups.length === 0) {
      setError('At least one group must retain access (or pick Everyone).');
      return;
    }
    setError(null);
    if (useServerRegistry) {
      try {
        const saved = await api.patchSource(instance.id, { groups });
        const normalized = normalizeSourceInstance(saved as unknown as Record<string, unknown>);
        persist(instances.map((i) => (i.id === instance.id ? normalized : i)));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to update groups');
      }
      return;
    }
    persist(
      instances.map((i) =>
        i.id === instance.id
          ? { ...i, groups, updatedAt: new Date().toISOString() }
          : i,
      ),
    );
  };

  const addableTypes = useMemo(() => {
    return SOURCE_TYPES.filter((t) => {
      if (t.advancedOnly && !developerMode) return false;
      if (t.singletonBuiltin) return false;
      if (!t.multiInstance && instances.some((i) => i.typeId === t.id)) return false;
      return true;
    });
  }, [developerMode, instances]);

  const instancesBySection = useMemo(() => {
    const order: SourceSection[] = ['builtin', 'apps', 'advanced'];
    return order
      .map((section) => ({
        section,
        items: instances.filter((inst) => {
          const t = getSourceType(inst.typeId);
          if (!t || t.section !== section) return false;
          if (t.advancedOnly && !developerMode) return false;
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [instances, developerMode]);

  const orphanCaps = useMemo(
    () => (data ? unmappedCapabilities(data.capabilities) : []),
    [data],
  );

  const renderInstance = (instance: SourceInstance) => {
    const type = getSourceType(instance.typeId);
    if (!type) return null;
    const packs = data?.capabilities ?? [];
    const status = instanceStatus(instance, packs, type);
    const open = expandedId === instance.id;
    const configOpen = configOpenId === instance.id;
    const draft = draftConfigs[instance.id] ?? instance.config;
    const nameDraft = draftNames[instance.id] ?? instance.displayName;

    return (
      <Card key={instance.id} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setExpandedId(open ? null : instance.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              {type.id === 'postgresql' ? (
                <Database className="h-4 w-4 text-cyan-400/80" />
              ) : (
                <Package className="h-4 w-4 text-cyan-400/80" />
              )}
              <h3 className="font-medium text-slate-100">{instance.displayName}</h3>
              <span className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-500">
                {type.displayName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-300">
                <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass(status)}`} />
                {statusLabel(status)}
              </span>
              {!instance.packBound && (
                <span className="rounded-md border border-violet-800/40 bg-violet-950/30 px-2 py-0.5 text-xs text-violet-300/90">
                  Console instance
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-400">{configSummary(type, instance.config)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Users className="h-3 w-3" />
              {instance.groups.length ? instance.groups.join(', ') : 'No groups'}
              <span className="text-slate-600">·</span>
              Policy:{' '}
              {instance.enabledPermissionIds.length
                ? instance.enabledPermissionIds
                    .map((id) => type.permissions.find((p) => p.id === id)?.label ?? id)
                    .join(', ')
                : 'none enabled'}
            </p>
          </button>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setExpandedId(instance.id);
                setConfigOpenId(configOpen ? null : instance.id);
                setDraftConfigs((d) => ({
                  ...d,
                  [instance.id]: { ...instance.config },
                }));
                setDraftNames((d) => ({ ...d, [instance.id]: instance.displayName }));
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure
            </Button>
            {!type.singletonBuiltin && (
              <Button variant="ghost" onClick={() => removeInstance(instance)} title="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" onClick={() => setExpandedId(open ? null : instance.id)}>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {(open || configOpen) && (
          <div className="space-y-4 border-t border-slate-800 pt-4">
            {configOpen && (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-medium text-slate-200">Connection</div>
                <p className="text-xs text-slate-500">
                  Configuration belongs on this instance—not a shared .env for all customers.
                  {type.connectHint ? ` ${type.connectHint}` : ''}
                </p>
                <div>
                  <Label>Display name</Label>
                  <Input
                    className="mt-1"
                    value={nameDraft}
                    onChange={(e) =>
                      setDraftNames((d) => ({ ...d, [instance.id]: e.target.value }))
                    }
                    placeholder={type.displayName}
                  />
                </div>
                {type.configFields.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Built-in source — no connection settings. Use policy and groups below.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {type.configFields.map((field) => (
                      <div key={field.key} className={field.secret ? 'sm:col-span-2' : undefined}>
                        <Label>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </Label>
                        <Input
                          className="mt-1"
                          type={field.inputType ?? (field.secret ? 'password' : 'text')}
                          value={draft[field.key] ?? ''}
                          placeholder={field.placeholder}
                          autoComplete="off"
                          onChange={(e) =>
                            setDraftConfigs((d) => ({
                              ...d,
                              [instance.id]: {
                                ...(d[instance.id] ?? instance.config),
                                [field.key]: e.target.value,
                              },
                            }))
                          }
                        />
                        {field.help && (
                          <p className="mt-1 text-xs text-slate-600">{field.help}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => saveInstanceConfig(instance)}>
                    Save connection
                  </Button>
                  <Button variant="secondary" onClick={() => setConfigOpenId(null)}>
                    Cancel
                  </Button>
                </div>
                {!instance.packBound && (
                  <p className="text-xs text-amber-200/80">
                    Multiple instances of the same type are saved in the console. Appliance-side
                    multi-source registry (per-instance secrets and MCP) ships next—only one
                    pack-bound instance can drive the live adapter today.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-200">Access groups</div>
              <p className="text-xs text-slate-500">
                Who may use this source instance. Enforcement hooks into SSO/ACL when identity is
                configured; until then this is the intended access matrix.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_GROUP_OPTIONS.map((g) => {
                  const on = instance.groups.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGroup(instance, g)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-200">Agent permissions</div>
              <p className="text-xs text-slate-500">
                Policy for this instance only. Same type can differ per instance (e.g. analytics DB
                read-only vs a later write-capable role). Upstream tokens/DB roles set the maximum;
                these toggles control what the AI may use.
              </p>
              {type.permissions.map((permission) => {
                const enabled = instance.enabledPermissionIds.includes(permission.id);
                const cap = permission.capabilityId
                  ? packById(data, permission.capabilityId)
                  : undefined;
                const unavailable =
                  instance.packBound && permission.capabilityId && !cap;
                const busy = busyKey === `${instance.id}:${permission.id}`;

                return (
                  <div
                    key={permission.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">
                            {permission.label}
                          </span>
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
                            Read-only access. Your data is never changed by this permission.
                          </p>
                        )}
                        {(permission.trust === 'propose' ||
                          permission.trust === 'high_impact') && (
                          <p className="pt-1 text-xs font-medium text-amber-300/80">
                            Suggestions require your approval before anything changes.
                          </p>
                        )}
                        {unavailable && (
                          <p className="pt-1 text-xs text-slate-600">
                            Not available on this appliance build.
                          </p>
                        )}
                      </div>
                      <Button
                        variant={enabled ? 'secondary' : 'primary'}
                        disabled={busy || Boolean(unavailable)}
                        onClick={() => togglePermission(instance, permission)}
                      >
                        {busy ? 'Saving…' : enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {developerMode && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-500">
                <div className="mb-1 font-medium text-slate-400">Technical details</div>
                <div>
                  Instance id: <code>{instance.id}</code>
                </div>
                <div>
                  Type: <code>{type.id}</code> · pack-bound: {String(instance.packBound)}
                </div>
                {type.permissions.map((p) => {
                  const cap = p.capabilityId ? packById(data, p.capabilityId) : undefined;
                  if (!cap) return null;
                  return (
                    <div key={p.id} className="mt-2 border-t border-slate-800/80 pt-2">
                      <div>
                        Capability: <code>{cap.id}</code>
                      </div>
                      <div>
                        Pack: {cap.pack} v{cap.pack_version} · tools:{' '}
                        {(cap.allowed_tools || []).join(', ') || '—'}
                      </div>
                      <div>
                        Backend: {cap.configured ? 'configured' : 'needs setup'}
                        {cap.configured_detail ? ` — ${cap.configured_detail}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {data && (
        <>
          <PageHeader
            title="Information sources"
            description="Connect systems the AI may use. Each connection is its own instance—with its own credentials, agent permissions, and groups. Add multiple databases or GitHub tokens when you need separate roles or scopes."
          />

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400 sm:flex-1">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/80" />
              <p>
                <strong className="text-slate-300">Instances, not global packs.</strong> One
                PostgreSQL type can have many instances (prod RO, analytics RO). Upstream tokens
                and DB roles set the ceiling; OwnEdge permissions are policy for the agent on that
                instance. Configuration is done here—not in a shared .env.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={developerMode}
                  onChange={(e) => setDeveloperMode(e.target.checked)}
                />
                Developer mode
              </label>
              <div className="relative">
                <Button variant="primary" onClick={() => setAddMenuOpen((v) => !v)}>
                  <Plus className="h-4 w-4" />
                  Add source
                </Button>
                {addMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                    <p className="px-2 py-1 text-xs text-slate-500">
                      Choose a type. You can add another instance of the same type later.
                    </p>
                    {addableTypes.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-slate-400">
                        No more types available. Enable Developer mode for advanced adapters.
                      </p>
                    ) : (
                      addableTypes.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                          onClick={() => addInstance(t)}
                        >
                          <div className="font-medium">{t.displayName}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{t.summary}</div>
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-800"
                      onClick={() => setAddMenuOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
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
                <code className="text-amber-100">ENABLE_MCP=false</code>). Sources will not expose
                tools until it is turned on.
              </p>
            </Card>
          )}

          <div className="space-y-8">
            {instancesBySection.map(({ section, items }) => (
              <section key={section} className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    {SECTION_META[section].title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{SECTION_META[section].description}</p>
                </div>
                <div className="space-y-4">{items.map(renderInstance)}</div>
              </section>
            ))}

            {instances.length === 0 && (
              <Card className="space-y-2 text-center">
                <p className="text-sm text-slate-300">No sources connected yet</p>
                <p className="text-xs text-slate-500">
                  Use Add source to connect PostgreSQL, GitHub, or other systems.
                </p>
              </Card>
            )}

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Coming soon
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Document suites and more databases—each supporting multiple instances (sites,
                  spaces, tenants).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMING_SOON_CONNECTORS.map((c) => (
                  <Card key={c.id} className="space-y-1 opacity-80">
                    <div className="text-sm font-medium text-slate-300">{c.displayName}</div>
                    <p className="text-xs text-slate-500">{c.summary}</p>
                    <span className="inline-block pt-1 text-xs text-slate-600">
                      Not available yet
                    </span>
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
                      <span className="ml-2 text-xs text-slate-500">
                        ({platform.agent_runtime})
                      </span>
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
                <div className="space-y-4 border-t border-slate-800 pt-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Production knowledge checklist
                    </div>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-400">
                      <li>
                        Deployments → add a model with role <strong className="text-slate-300">Embedding</strong>{' '}
                        (serves LiteLLM alias <code className="text-slate-400">embedding</code>).
                      </li>
                      <li>
                        Set embedding model id below to <code className="text-slate-400">embedding</code>{' '}
                        (or the deployment display name), match embedding dim to the model, then Save.
                      </li>
                      <li>
                        Click <strong className="text-slate-300">Reindex corpus</strong> so stored vectors match
                        the live model (required after any model/dim change).
                      </li>
                      <li>
                        Optional: enable <strong className="text-slate-300">Require real embeddings</strong> so
                        hash fallback cannot silently degrade search quality.
                      </li>
                    </ol>
                    {ragHealth && (
                      <ul className="mt-3 space-y-1 text-xs">
                        {ragHealth.checklist.map((item) => (
                          <li key={item.id} className="flex gap-2">
                            <span
                              className={
                                item.status === 'ok'
                                  ? 'text-emerald-400'
                                  : item.status === 'error'
                                    ? 'text-rose-400'
                                    : item.status === 'warn'
                                      ? 'text-amber-400'
                                      : 'text-sky-400'
                              }
                            >
                              [{item.status}]
                            </span>
                            <span className="text-slate-400">{item.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
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
                      <Label>Embedding dim</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        value={ragDraft.embedding_dim}
                        onChange={(e) =>
                          setRagDraft({
                            ...ragDraft,
                            embedding_dim: Number(e.target.value) || 384,
                          })
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
                    <div className="flex items-end sm:col-span-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          className="rounded border-slate-600 bg-slate-900"
                          checked={Boolean(ragDraft.require_real_embeddings)}
                          onChange={(e) =>
                            setRagDraft({
                              ...ragDraft,
                              require_real_embeddings: e.target.checked,
                            })
                          }
                        />
                        Require real embeddings (fail closed — no hash fallback)
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-3">
                      <Button variant="secondary" disabled={savingPlatform} onClick={saveRag}>
                        Save knowledge settings
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={reindexing || savingPlatform}
                        onClick={runReindex}
                      >
                        {reindexing ? 'Reindexing…' : 'Reindex corpus'}
                      </Button>
                    </div>
                    {ragSaveWarning ? (
                      <p className="sm:col-span-3 text-xs text-amber-300/95" role="status">
                        {ragSaveWarning}
                      </p>
                    ) : null}
                    {reindexStatus ? (
                      <p className="sm:col-span-3 text-xs text-emerald-300/90" role="status">
                        {reindexStatus}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </Card>
          )}

          {developerMode && orphanCaps.length > 0 && (
            <Card className="mt-4 space-y-2 border-slate-700/80">
              <div className="text-sm font-medium text-slate-200">Unmapped capabilities</div>
              <p className="text-xs text-slate-500">
                Internal packs on the controller without a source type presentation.
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
