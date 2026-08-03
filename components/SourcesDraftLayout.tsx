'use client';

import { useMemo, useState } from 'react';
import {
  Database,
  Package,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

import { Modal } from '@/components/Modal';
import { SourceInstanceBadge } from '@/components/StatusBadge';
import { Button, Card, Input, Label } from '@/components/ui';
import {
  COMING_SOON_CONNECTORS,
  DEFAULT_GROUP_OPTIONS,
  DRAFT_SECTION_META,
  configSummary,
  getSourceType,
  instanceConfigComplete,
  instanceStatus,
  trustLabel,
  trustTone,
  type PermissionTemplate,
  type SourceInstance,
  type SourceTypeDef,
  type SourceTypeRow,
} from '@/lib/connectors';
import type { CapabilitiesResponse, CapabilityPack } from '@/lib/types';

function packById(data: CapabilitiesResponse | null, id: string): CapabilityPack | undefined {
  return data?.capabilities.find((c) => c.id === id);
}

function findInstance(
  typeSections: { section: string; rows: SourceTypeRow[] }[],
  typeId: string,
  instanceId: string,
): SourceInstance | null {
  for (const g of typeSections) {
    const row = g.rows.find((r) => r.type.id === typeId);
    const inst = row?.instances.find((i) => i.id === instanceId);
    if (inst) return inst;
  }
  return null;
}

type ModalState = {
  typeId: string;
  instanceId: string;
  /** Fresh "Add instance" flow — cancel discards the draft row. */
  mode: 'create' | 'edit';
};

export function SourcesDraftLayout({
  typeSections,
  data,
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
  developerMode: boolean;
  busyKey: string | null;
  draftConfigs: Record<string, Record<string, string>>;
  setDraftConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  draftNames: Record<string, string>;
  setDraftNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddInstance: (type: SourceTypeDef) => Promise<SourceInstance | null> | SourceInstance | null | void;
  onRemoveInstance: (
    instance: SourceInstance,
    options?: { silent?: boolean },
  ) => void | Promise<void | boolean>;
  onSaveInstanceConfig: (instance: SourceInstance) => void | Promise<void | boolean>;
  onToggleGroup: (instance: SourceInstance, group: string) => void | Promise<void>;
  onTogglePermission: (instance: SourceInstance, permission: PermissionTemplate) => void | Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);

  const modalType = modal ? getSourceType(modal.typeId) : undefined;
  const modalInstance = useMemo(() => {
    if (!modal) return null;
    return findInstance(typeSections, modal.typeId, modal.instanceId);
  }, [modal, typeSections]);

  const hydrateDrafts = (instance: SourceInstance) => {
    setDraftConfigs((d) => ({
      ...d,
      [instance.id]: d[instance.id] ?? { ...instance.config },
    }));
    setDraftNames((d) => ({
      ...d,
      [instance.id]: d[instance.id] ?? instance.displayName,
    }));
  };

  const openInstance = (type: SourceTypeDef, instance: SourceInstance) => {
    hydrateDrafts(instance);
    setModal({ typeId: type.id, instanceId: instance.id, mode: 'edit' });
  };

  /** Create a new instance (or ensure singleton exists), then open it in the modal. */
  const openCreateOrEnsure = async (type: SourceTypeDef) => {
    setOpening(true);
    try {
      if (!type.multiInstance) {
        const existing = typeSections
          .flatMap((g) => g.rows)
          .find((r) => r.type.id === type.id)
          ?.instances[0];
        if (existing) {
          openInstance(type, existing);
          return;
        }
      }
      const created = await onAddInstance(type);
      if (created) {
        setDraftConfigs((d) => ({ ...d, [created.id]: { ...created.config } }));
        setDraftNames((d) => ({ ...d, [created.id]: created.displayName }));
        setModal({ typeId: type.id, instanceId: created.id, mode: 'create' });
      }
    } finally {
      setOpening(false);
    }
  };

  const clearDraftsFor = (instanceId: string) => {
    setDraftConfigs((d) => {
      const next = { ...d };
      delete next[instanceId];
      return next;
    });
    setDraftNames((d) => {
      const next = { ...d };
      delete next[instanceId];
      return next;
    });
  };

  const closeModal = () => setModal(null);

  /** Cancel create: discard the draft instance. Edit cancel: just close. */
  const handleCancel = async () => {
    if (!modal || !modalInstance) {
      closeModal();
      return;
    }
    if (modal.mode === 'create') {
      const instance = modalInstance;
      closeModal();
      clearDraftsFor(instance.id);
      await onRemoveInstance(instance, { silent: true });
      return;
    }
    clearDraftsFor(modalInstance.id);
    closeModal();
  };

  const handleSave = async () => {
    if (!modalInstance) return;
    setSaving(true);
    try {
      const ok = await onSaveInstanceConfig(modalInstance);
      if (ok !== false) {
        closeModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromList = async (instance: SourceInstance) => {
    if (modal?.instanceId === instance.id) {
      closeModal();
    }
    await onRemoveInstance(instance);
  };

  const isCreate = modal?.mode === 'create';
  const modalTitle = isCreate
    ? `Add ${modalType?.displayName ?? 'instance'}`
    : modalInstance
      ? draftNames[modalInstance.id] || modalInstance.displayName
      : modalType?.displayName ?? 'Source';

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
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{row.type.summary}</p>

                      {row.instances.length > 0 ? (
                        <ul className="mt-3 divide-y divide-slate-800/80 overflow-hidden rounded-lg border border-slate-800">
                          {row.instances.map((inst) => {
                            const packs = data?.capabilities ?? [];
                            const status = instanceStatus(inst, packs, row.type);
                            return (
                              <li
                                key={inst.id}
                                className="flex items-start justify-between gap-2 px-3 py-2.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-slate-200">
                                      {inst.displayName}
                                    </span>
                                    <SourceInstanceBadge status={status} />
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {configSummary(row.type, inst.config)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                  <Button
                                    variant="secondary"
                                    className="px-2.5 py-1.5"
                                    onClick={() => openInstance(row.type, inst)}
                                    title="Edit instance"
                                    aria-label={`Edit ${inst.displayName}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  {!row.type.singletonBuiltin && (
                                    <Button
                                      variant="danger"
                                      className="px-2.5 py-1.5"
                                      onClick={() => handleRemoveFromList(inst)}
                                      title="Remove instance"
                                      aria-label={`Remove ${inst.displayName}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">
                          {row.type.multiInstance
                            ? 'No instances yet. Add one to connect this service.'
                            : 'Not set up yet.'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.type.multiInstance ? (
                        <Button
                          variant="primary"
                          disabled={opening}
                          onClick={() => openCreateOrEnsure(row.type)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add instance
                        </Button>
                      ) : (
                        row.instances.length === 0 && (
                          <Button
                            variant="primary"
                            disabled={opening}
                            onClick={() => openCreateOrEnsure(row.type)}
                          >
                            Set up
                          </Button>
                        )
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
        open={Boolean(modal && modalType && modalInstance)}
        title={modalTitle}
        description={modalType?.summary}
        onClose={handleCancel}
        wide
      >
        {modalType && modalInstance && (
          <InstanceEditor
            type={modalType}
            instance={modalInstance}
            mode={modal?.mode ?? 'edit'}
            data={data}
            developerMode={developerMode}
            busyKey={busyKey}
            saving={saving}
            draft={draftConfigs[modalInstance.id] ?? modalInstance.config}
            nameDraft={draftNames[modalInstance.id] ?? modalInstance.displayName}
            setDraftConfigs={setDraftConfigs}
            setDraftNames={setDraftNames}
            onSave={handleSave}
            onCancel={handleCancel}
            onToggleGroup={onToggleGroup}
            onTogglePermission={onTogglePermission}
          />
        )}
      </Modal>
    </>
  );
}

function InstanceEditor({
  type,
  instance,
  mode,
  data,
  developerMode,
  busyKey,
  saving,
  draft,
  nameDraft,
  setDraftConfigs,
  setDraftNames,
  onSave,
  onCancel,
  onToggleGroup,
  onTogglePermission,
}: {
  type: SourceTypeDef;
  instance: SourceInstance;
  mode: 'create' | 'edit';
  data: CapabilitiesResponse | null;
  developerMode: boolean;
  busyKey: string | null;
  saving: boolean;
  draft: Record<string, string>;
  nameDraft: string;
  setDraftConfigs: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  setDraftNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onToggleGroup: (instance: SourceInstance, group: string) => void | Promise<void>;
  onTogglePermission: (instance: SourceInstance, permission: PermissionTemplate) => void | Promise<void>;
}) {
  const packs = data?.capabilities ?? [];
  const status = instanceStatus(instance, packs, type);
  const canSave =
    type.configFields.length === 0 || instanceConfigComplete(type, draft);

  return (
    <div className="space-y-5">
      {mode === 'edit' && (
        <div className="flex flex-wrap items-center gap-2">
          <SourceInstanceBadge status={status} />
        </div>
      )}

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
                {field.help && <p className="mt-1 text-xs text-slate-600">{field.help}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-200">Access groups</div>
        <p className="text-xs text-slate-500">
          Who may use this instance. Enforcement follows SSO/ACL when identity is configured.
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
        <div className="text-sm font-medium text-slate-200">Agent permissions</div>
        <p className="text-xs text-slate-500">
          Policy for this instance only. Upstream tokens/DB roles set the maximum; these toggles
          control what the AI may use.
        </p>
        {type.permissions.map((permission) => {
          const enabled = instance.enabledPermissionIds.includes(permission.id);
          const cap = permission.capabilityId
            ? packById(data, permission.capabilityId)
            : undefined;
          const unavailable = instance.packBound && permission.capabilityId && !cap;
          const busy = busyKey === `${instance.id}:${permission.id}`;

          return (
            <div
              key={permission.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
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

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
        <Button variant="secondary" onClick={() => onCancel()} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave()} disabled={saving || !canSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
