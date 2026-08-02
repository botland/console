'use client';

import { useMemo, useState } from 'react';
import {
  Database,
  Package,
  Plus,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';

import { Modal } from '@/components/Modal';
import { Button, Card, Input, Label } from '@/components/ui';
import {
  COMING_SOON_CONNECTORS,
  DEFAULT_GROUP_OPTIONS,
  DRAFT_SECTION_META,
  configSummary,
  getSourceType,
  instanceConfigComplete,
  instanceStatus,
  statusDotClass,
  statusLabel,
  trustLabel,
  trustTone,
  typeRowSummary,
  type PermissionTemplate,
  type SourceInstance,
  type SourceTypeDef,
  type SourceTypeRow,
} from '@/lib/connectors';
import type { CapabilitiesResponse, CapabilityPack } from '@/lib/types';

function packById(data: CapabilitiesResponse | null, id: string): CapabilityPack | undefined {
  return data?.capabilities.find((c) => c.id === id);
}

export function SourcesDraftLayout({
  typeSections,
  data,
  useServerRegistry,
  developerMode,
  busyKey,
  draftConfigs,
  setDraftConfigs,
  draftNames,
  setDraftNames,
  onAddInstance,
  onRemoveInstance,
  onSaveInstanceConfig,
  onToggleGroup,
  onTogglePermission,
}: {
  typeSections: { section: 'builtin' | 'apps' | 'advanced'; rows: SourceTypeRow[] }[];
  data: CapabilitiesResponse | null;
  useServerRegistry: boolean;
  developerMode: boolean;
  busyKey: string | null;
  draftConfigs: Record<string, Record<string, string>>;
  setDraftConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  draftNames: Record<string, string>;
  setDraftNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddInstance: (type: SourceTypeDef) => Promise<SourceInstance | null> | SourceInstance | null | void;
  onRemoveInstance: (instance: SourceInstance) => void | Promise<void>;
  onSaveInstanceConfig: (instance: SourceInstance) => void | Promise<void>;
  onToggleGroup: (instance: SourceInstance, group: string) => void | Promise<void>;
  onTogglePermission: (instance: SourceInstance, permission: PermissionTemplate) => void | Promise<void>;
}) {
  const [modalTypeId, setModalTypeId] = useState<string | null>(null);
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const modalType = modalTypeId ? getSourceType(modalTypeId) : undefined;
  const modalRow = useMemo(() => {
    if (!modalTypeId) return null;
    for (const g of typeSections) {
      const row = g.rows.find((r) => r.type.id === modalTypeId);
      if (row) return row;
    }
    return null;
  }, [modalTypeId, typeSections]);

  const openConfigure = async (type: SourceTypeDef) => {
    setOpening(true);
    try {
      // Ensure singleton builtins have a row so the modal is not empty.
      if (type.singletonBuiltin) {
        const has = typeSections.some((g) =>
          g.rows.some((r) => r.type.id === type.id && r.instances.length > 0),
        );
        if (!has) {
          const created = await onAddInstance(type);
          if (created) {
            setExpandedInstanceId(created.id);
            setDraftConfigs((d) => ({ ...d, [created.id]: { ...created.config } }));
            setDraftNames((d) => ({ ...d, [created.id]: created.displayName }));
          }
        }
      }
      setModalTypeId(type.id);
      const existing = typeSections
        .flatMap((g) => g.rows)
        .find((r) => r.type.id === type.id)?.instances[0];
      if (existing) {
        setExpandedInstanceId(existing.id);
        setDraftConfigs((d) => ({
          ...d,
          [existing.id]: d[existing.id] ?? { ...existing.config },
        }));
        setDraftNames((d) => ({
          ...d,
          [existing.id]: d[existing.id] ?? existing.displayName,
        }));
      }
    } finally {
      setOpening(false);
    }
  };

  const handleAddInModal = async (type?: SourceTypeDef) => {
    const t = type ?? modalType;
    if (!t) return;
    if (type) setModalTypeId(type.id);
    const created = await onAddInstance(t);
    if (created) {
      setExpandedInstanceId(created.id);
      setDraftConfigs((d) => ({ ...d, [created.id]: { ...created.config } }));
      setDraftNames((d) => ({ ...d, [created.id]: created.displayName }));
    }
  };

  const backendLabel = useServerRegistry ? 'Appliance registry' : 'Console draft (local)';

  return (
    <>
      <div className="space-y-8">
        {typeSections.map(({ section, rows }) => (
          <section key={section} className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                {DRAFT_SECTION_META[section].title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {DRAFT_SECTION_META[section].description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((row) => {
                const displayStatus =
                  row.instances.length === 0 ? 'needs_setup' : row.aggregateStatus;
                return (
                  <Card key={row.type.id} className="flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.type.id === 'postgresql' ? (
                          <Database className="h-4 w-4 text-cyan-400/80" />
                        ) : (
                          <Package className="h-4 w-4 text-cyan-400/80" />
                        )}
                        <h3 className="font-medium text-slate-100">{row.type.displayName}</h3>
                        {row.type.singletonBuiltin && (
                          <span className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-500">
                            Built-in
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-xs text-slate-300">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${statusDotClass(displayStatus)}`}
                          />
                          {typeRowSummary(row)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{row.type.summary}</p>
                      {row.instances.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                          {row.instances.slice(0, 3).map((inst) => (
                            <li key={inst.id} className="truncate">
                              {inst.displayName}
                              {inst.config && Object.keys(inst.config).length > 0
                                ? ` · ${configSummary(row.type, inst.config)}`
                                : ''}
                            </li>
                          ))}
                          {row.instances.length > 3 && (
                            <li>+{row.instances.length - 3} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        disabled={opening}
                        onClick={() => openConfigure(row.type)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Configure
                      </Button>
                      {row.type.multiInstance && (
                        <Button
                          variant="secondary"
                          disabled={opening}
                          onClick={async () => {
                            setOpening(true);
                            try {
                              await handleAddInModal(row.type);
                            } finally {
                              setOpening(false);
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add instance
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Coming soon
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Document suites and more databases—each supporting multiple instances (sites, spaces,
              tenants).
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

      <Modal
        open={Boolean(modalType && modalRow)}
        title={modalType?.displayName ?? 'Source'}
        description={modalType?.summary}
        onClose={() => setModalTypeId(null)}
        wide
      >
        {modalType && modalRow && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-0.5">
                Backend: {backendLabel}
              </span>
              <span>
                {modalRow.instances.length} instance
                {modalRow.instances.length === 1 ? '' : 's'}
              </span>
              {modalType.connectHint ? (
                <span className="text-slate-600">· {modalType.connectHint}</span>
              ) : null}
            </div>

            {modalRow.instances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
                <p className="text-sm text-slate-300">No instances yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add an instance to configure connection, groups, and agent permissions.
                </p>
                <Button className="mt-4" variant="primary" onClick={() => handleAddInModal()}>
                  <Plus className="h-4 w-4" />
                  Add instance
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {modalRow.instances.map((instance) => {
                  const packs = data?.capabilities ?? [];
                  const status = instanceStatus(instance, packs, modalType);
                  const open = expandedInstanceId === instance.id;
                  const draft = draftConfigs[instance.id] ?? instance.config;
                  const nameDraft = draftNames[instance.id] ?? instance.displayName;

                  return (
                    <div
                      key={instance.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/40"
                    >
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                        onClick={() => {
                          setExpandedInstanceId(open ? null : instance.id);
                          setDraftConfigs((d) => ({
                            ...d,
                            [instance.id]: d[instance.id] ?? { ...instance.config },
                          }));
                          setDraftNames((d) => ({
                            ...d,
                            [instance.id]: d[instance.id] ?? instance.displayName,
                          }));
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-100">
                              {instance.displayName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-xs text-slate-300">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${statusDotClass(status)}`}
                              />
                              {statusLabel(status)}
                            </span>
                            {instance.packBound ? (
                              <span className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                                Pack-bound adapter
                              </span>
                            ) : (
                              <span className="rounded-md border border-violet-800/40 bg-violet-950/30 px-2 py-0.5 text-xs text-violet-300/90">
                                Multi-instance row
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {configSummary(modalType, instance.config)}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">{open ? 'Hide' : 'Edit'}</span>
                      </button>

                      {open && (
                        <div className="space-y-4 border-t border-slate-800 px-4 py-4">
                          <div className="space-y-3">
                            <div className="text-sm font-medium text-slate-200">Connection</div>
                            <div>
                              <Label>Display name</Label>
                              <Input
                                className="mt-1"
                                value={nameDraft}
                                onChange={(e) =>
                                  setDraftNames((d) => ({
                                    ...d,
                                    [instance.id]: e.target.value,
                                  }))
                                }
                                placeholder={modalType.displayName}
                              />
                            </div>
                            {modalType.configFields.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                Built-in source — no connection settings. Use policy and groups
                                below.
                              </p>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {modalType.configFields.map((field) => (
                                  <div
                                    key={field.key}
                                    className={field.secret ? 'sm:col-span-2' : undefined}
                                  >
                                    <Label>
                                      {field.label}
                                      {field.required ? ' *' : ''}
                                    </Label>
                                    <Input
                                      className="mt-1"
                                      type={
                                        field.inputType ?? (field.secret ? 'password' : 'text')
                                      }
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
                              <Button
                                variant="primary"
                                onClick={() => onSaveInstanceConfig(instance)}
                                disabled={
                                  modalType.configFields.length > 0 &&
                                  !instanceConfigComplete(
                                    modalType,
                                    draftConfigs[instance.id] ?? instance.config,
                                  )
                                }
                              >
                                Save connection
                              </Button>
                              {!modalType.singletonBuiltin && (
                                <Button
                                  variant="ghost"
                                  onClick={() => onRemoveInstance(instance)}
                                  title="Remove instance"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              )}
                            </div>
                            {!instance.packBound && (
                              <p className="text-xs text-amber-200/80">
                                Saved on {useServerRegistry ? 'the appliance registry' : 'this console'}.
                                Live MCP adapters are still mostly singleton until multi-source
                                ships—only a pack-bound instance drives the live adapter today.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-200">Access groups</div>
                            <p className="text-xs text-slate-500">
                              Who may use this instance. Enforcement follows SSO/ACL when identity
                              is configured.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {DEFAULT_GROUP_OPTIONS.map((g) => {
                                const on = instance.groups.includes(g);
                                return (
                                  <button
                                    key={g}
                                    type="button"
                                    onClick={() => onToggleGroup(instance, g)}
                                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                                      on
                                        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                                        : 'border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600'
                                    }`}
                                  >
                                    <Users className="mr-1 inline h-3 w-3" />
                                    {g}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="text-sm font-medium text-slate-200">
                              Agent permissions
                            </div>
                            <p className="text-xs text-slate-500">
                              Policy for this instance only. Upstream tokens/DB roles set the
                              maximum; these toggles control what the AI may use.
                            </p>
                            {modalType.permissions.map((permission) => {
                              const enabled = instance.enabledPermissionIds.includes(
                                permission.id,
                              );
                              const cap = permission.capabilityId
                                ? packById(data, permission.capabilityId)
                                : undefined;
                              const unavailable =
                                instance.packBound && permission.capabilityId && !cap;
                              const busy = busyKey === `${instance.id}:${permission.id}`;

                              return (
                                <div
                                  key={permission.id}
                                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
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
                                      <p className="text-xs text-slate-500">
                                        {permission.description}
                                      </p>
                                      <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                                        {permission.canDo.map((line) => (
                                          <li key={line} className="flex gap-1.5">
                                            <span className="text-emerald-500/80">✓</span>
                                            <span>{line}</span>
                                          </li>
                                        ))}
                                      </ul>
                                      {unavailable && (
                                        <p className="pt-1 text-xs text-slate-600">
                                          Not available on this appliance build.
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      variant={enabled ? 'secondary' : 'primary'}
                                      disabled={busy || Boolean(unavailable)}
                                      onClick={() => onTogglePermission(instance, permission)}
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
                              <div className="mb-1 font-medium text-slate-400">
                                Technical details
                              </div>
                              <div>
                                Instance id: <code>{instance.id}</code>
                              </div>
                              <div>
                                Type: <code>{modalType.id}</code> · pack-bound:{' '}
                                {String(instance.packBound)}
                              </div>
                              {modalType.permissions.map((p) => {
                                const cap = p.capabilityId
                                  ? packById(data, p.capabilityId)
                                  : undefined;
                                if (!cap) return null;
                                return (
                                  <div
                                    key={p.id}
                                    className="mt-2 border-t border-slate-800/80 pt-2"
                                  >
                                    <div>
                                      Capability: <code>{cap.id}</code>
                                    </div>
                                    <div>
                                      Pack: {cap.pack} v{cap.pack_version} · tools:{' '}
                                      {(cap.allowed_tools || []).join(', ') || '—'}
                                    </div>
                                    <div>
                                      Backend: {cap.configured ? 'configured' : 'needs setup'}
                                      {cap.configured_detail
                                        ? ` — ${cap.configured_detail}`
                                        : ''}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {modalType.multiInstance && modalRow.instances.length > 0 && (
              <Button variant="secondary" onClick={() => handleAddInModal()}>
                <Plus className="h-4 w-4" />
                Add instance
              </Button>
            )}

            <div className="flex justify-end border-t border-slate-800 pt-4">
              <Button variant="secondary" onClick={() => setModalTypeId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
