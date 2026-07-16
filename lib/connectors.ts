/**
 * Customer-facing information sources model.
 *
 * Product shape:
 *   Source type  → catalog template (PostgreSQL, GitHub, …)
 *   Source instance → one connected system (prod-ro DB, eng GitHub app, …)
 *
 * Each instance has its own configuration, policy permissions, and groups.
 * Capability packs / MCP servers stay internal (Technical details only).
 */

import type { CapabilityPack } from '@/lib/types';

export type SourceSection = 'builtin' | 'apps' | 'advanced';

/** Progressive-trust policy bands — shared across source types. */
export type TrustKind = 'read' | 'create' | 'propose' | 'high_impact';

export type InstanceStatus =
  | 'connected'
  | 'ready'
  | 'needs_setup'
  | 'error'
  | 'draft';

export interface ConfigField {
  key: string;
  label: string;
  /** Hint under the field */
  help?: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  /** text | password | url */
  inputType?: 'text' | 'password' | 'url';
}

/**
 * Policy permission offered by a source type (not a tool list).
 * Enable/disable is a policy choice on this instance.
 */
export interface PermissionTemplate {
  id: string;
  label: string;
  description: string;
  trust: TrustKind;
  /** Plain-language outcomes (not MCP tool names). */
  canDo: string[];
  /**
   * Optional bridge to today's singleton capability packs.
   * Multi-instance backends will replace this with per-instance grants.
   */
  capabilityId?: string;
}

export interface SourceTypeDef {
  id: string;
  section: SourceSection;
  displayName: string;
  summary: string;
  /** Customer may create multiple named instances of this type. */
  multiInstance: boolean;
  /** When true, only shown with Developer mode. */
  advancedOnly?: boolean;
  /** Builtin / always-present single instance (e.g. appliance knowledge). */
  singletonBuiltin?: boolean;
  configFields: ConfigField[];
  permissions: PermissionTemplate[];
  /** Shown when no instances yet or under the add dialog. */
  connectHint?: string;
}

/** One configured (or draft) connection of a source type. */
export interface SourceInstance {
  id: string;
  typeId: string;
  /** Customer label, e.g. "Prod analytics (read-only)". */
  displayName: string;
  /** Non-secret config values + secret placeholders (never store real secrets in localStorage long-term). */
  config: Record<string, string>;
  /** Permission template ids that are enabled for the agent on this instance. */
  enabledPermissionIds: string[];
  /** Console / IdP groups allowed to use this instance (product model; enforcement later). */
  groups: string[];
  /**
   * When true, this instance is bound to the appliance's singleton pack adapters
   * (current controller). Additional instances of multi-instance types are
   * console-side until a multi-source registry ships.
   */
  packBound: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_GROUP_OPTIONS = [
  'Admins',
  'Operators',
  'Analysts',
  'Everyone',
] as const;

/** Static product catalog of source types. */
export const SOURCE_TYPES: SourceTypeDef[] = [
  {
    id: 'appliance-knowledge',
    section: 'builtin',
    displayName: 'Appliance knowledge',
    summary:
      'On-box documentation the AI can search. One corpus per appliance; permissions control what the agent may do.',
    multiInstance: false,
    singletonBuiltin: true,
    configFields: [],
    permissions: [
      {
        id: 'read',
        label: 'Search & answer',
        description: 'Read-only access so the AI can answer from your documentation.',
        trust: 'read',
        canDo: ['Search documentation', 'Read documents', 'Answer questions from the corpus'],
        capabilityId: 'knowledge.search',
      },
      {
        id: 'propose',
        label: 'Suggest edits',
        description: 'AI can prepare documentation edits. Nothing applies without your approval.',
        trust: 'propose',
        canDo: ['Propose documentation edits', 'Preview changes before approval'],
        capabilityId: 'knowledge.propose_edit',
      },
      {
        id: 'create',
        label: 'Create drafts',
        description: 'AI can create new draft notes only. Existing documents are never modified.',
        trust: 'create',
        canDo: ['Create new draft items', 'List draft items'],
        capabilityId: 'notes.create',
      },
      {
        id: 'high_impact',
        label: 'Propose archive',
        description:
          'AI can propose moving staging files to trash. Always needs your confirmation. Not permanent delete.',
        trust: 'high_impact',
        canDo: ['Propose soft-archive', 'Preview before approval'],
        capabilityId: 'knowledge.propose_archive',
      },
    ],
  },
  {
    id: 'postgresql',
    section: 'apps',
    displayName: 'PostgreSQL',
    summary:
      'Read-only (and later progressive-trust) access to a database. Use a separate instance per database or role.',
    multiInstance: true,
    configFields: [
      {
        key: 'host',
        label: 'Host',
        placeholder: 'db.internal.example.com',
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        placeholder: '5432',
      },
      {
        key: 'database',
        label: 'Database',
        placeholder: 'app_db',
        required: true,
      },
      {
        key: 'username',
        label: 'Username',
        placeholder: 'ownedge_ro',
        required: true,
        help: 'Prefer a read-only DB role; OwnEdge policy is layered on top.',
      },
      {
        key: 'password',
        label: 'Password',
        secret: true,
        inputType: 'password',
        required: true,
        help: 'Stored on the appliance secret store when multi-instance API ships; not committed to git.',
      },
      {
        key: 'sslMode',
        label: 'SSL mode',
        placeholder: 'require',
        help: 'e.g. disable, prefer, require',
      },
    ],
    permissions: [
      {
        id: 'read',
        label: 'Read-only queries',
        description: 'List tables, describe schema, and run SELECT. No writes or DDL.',
        trust: 'read',
        canDo: ['List tables and views', 'Describe columns', 'Run read-only SQL'],
        capabilityId: 'sql.query',
      },
    ],
    connectHint: 'Add one instance per database or DB role (e.g. analytics RO vs app RO).',
  },
  {
    id: 'github',
    section: 'apps',
    displayName: 'GitHub',
    summary:
      'Let the AI answer from repositories. Use a separate instance per org, app, or token scope.',
    multiInstance: true,
    configFields: [
      {
        key: 'owner',
        label: 'Owner (user or org)',
        placeholder: 'acme-corp',
        required: true,
      },
      {
        key: 'repos',
        label: 'Repositories',
        placeholder: 'api, docs (empty = all visible to the token)',
        help: 'Optional allowlist. Token scopes set the maximum; OwnEdge policy narrows agent use.',
      },
      {
        key: 'token',
        label: 'Personal access token',
        secret: true,
        inputType: 'password',
        required: true,
        help: 'Prefer a fine-grained or classic token with the least scopes you need (usually read-only contents).',
      },
    ],
    permissions: [
      {
        id: 'read',
        label: 'Read repositories',
        description: 'Search code, history, and files. Never pushes or rewrites.',
        trust: 'read',
        canDo: ['List branches and tags', 'Search commit history', 'Read and search files'],
        // Local git pack is interim until GitHub MCP is multi-instance
        capabilityId: 'git.search',
      },
    ],
    connectHint: 'Separate instances for eng vs docs orgs, or read-only vs PR-capable tokens later.',
  },
  {
    id: 'git-local',
    section: 'advanced',
    displayName: 'Local Git mount',
    summary: 'Operator path: a repo directory on the appliance. Prefer GitHub for customers.',
    multiInstance: true,
    advancedOnly: true,
    configFields: [
      {
        key: 'repoPath',
        label: 'Repository path on appliance',
        placeholder: '/config/mcp/repos/my-repo',
        required: true,
      },
    ],
    permissions: [
      {
        id: 'read',
        label: 'Read repository',
        description: 'Search commits, refs, and files. Never writes or pushes.',
        trust: 'read',
        canDo: ['List branches and tags', 'Search commit history', 'Read and search files'],
        capabilityId: 'git.search',
      },
    ],
  },
  {
    id: 'object-storage',
    section: 'advanced',
    displayName: 'Object storage (S3)',
    summary:
      'Low-level S3-compatible access. Prefer SharePoint, OneDrive, or Drive when available.',
    multiInstance: true,
    advancedOnly: true,
    configFields: [
      { key: 'bucket', label: 'Bucket', required: true },
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
      { key: 'prefix', label: 'Prefix', placeholder: 'docs/' },
      {
        key: 'accessKeyId',
        label: 'Access key ID',
        secret: true,
        required: true,
      },
      {
        key: 'secretAccessKey',
        label: 'Secret access key',
        secret: true,
        inputType: 'password',
        required: true,
      },
    ],
    permissions: [
      {
        id: 'read',
        label: 'List & read objects',
        description: 'Read-only list and get under a prefix. No upload or delete.',
        trust: 'read',
        canDo: ['List objects', 'Read object contents'],
        capabilityId: 's3.read',
      },
    ],
  },
];

/** @deprecated Prefer SOURCE_TYPES — kept for gradual migration. */
export const CONNECTOR_DEFS = SOURCE_TYPES;

export const COMING_SOON_CONNECTORS: {
  id: string;
  displayName: string;
  summary: string;
}[] = [
  {
    id: 'microsoft-365',
    displayName: 'Microsoft 365',
    summary: 'SharePoint, OneDrive, Outlook, Teams — planned. Multiple sites/tenants as instances.',
  },
  {
    id: 'atlassian',
    displayName: 'Atlassian',
    summary: 'Confluence and Jira — planned. Multiple spaces as instances.',
  },
  {
    id: 'google-workspace',
    displayName: 'Google Workspace',
    summary: 'Drive, Gmail, Calendar — planned.',
  },
  {
    id: 'mysql-ldap',
    displayName: 'MySQL & LDAP',
    summary: 'Additional enterprise systems — planned after PostgreSQL.',
  },
];

export function getSourceType(typeId: string): SourceTypeDef | undefined {
  return SOURCE_TYPES.find((t) => t.id === typeId);
}

export function trustLabel(trust: TrustKind): string {
  switch (trust) {
    case 'read':
      return 'Read only';
    case 'create':
      return 'Creates new items only';
    case 'propose':
      return 'Needs approval to apply';
    case 'high_impact':
      return 'High impact — always confirm';
  }
}

export function trustTone(trust: TrustKind): string {
  switch (trust) {
    case 'read':
      return 'bg-emerald-950/50 text-emerald-400/90 border-emerald-800/40';
    case 'create':
      return 'bg-sky-950/40 text-sky-300/90 border-sky-800/40';
    case 'propose':
      return 'bg-amber-950/40 text-amber-300/90 border-amber-800/40';
    case 'high_impact':
      return 'bg-rose-950/40 text-rose-300/90 border-rose-800/40';
  }
}

export function statusLabel(status: InstanceStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'ready':
      return 'Ready to enable';
    case 'needs_setup':
      return 'Needs setup';
    case 'error':
      return 'Unavailable';
    case 'draft':
      return 'Draft';
  }
}

export function statusDotClass(status: InstanceStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-400';
    case 'ready':
      return 'bg-sky-400';
    case 'needs_setup':
    case 'draft':
      return 'bg-amber-400';
    case 'error':
      return 'bg-rose-400';
  }
}

export function enableConfirmMessage(permission: PermissionTemplate): string | null {
  if (permission.trust === 'read') return null;
  if (permission.trust === 'create') {
    return `${permission.label}: the AI may create new items only. Existing data is not modified. Continue?`;
  }
  if (permission.trust === 'propose') {
    return `${permission.label}: the AI may propose changes. Nothing is applied without your approval. Continue?`;
  }
  return `${permission.label}: the AI may propose high-impact actions. You must always confirm before anything applies. Continue?`;
}

/** Required config keys filled (secrets may be placeholder "••••" once saved). */
export function instanceConfigComplete(
  type: SourceTypeDef,
  config: Record<string, string>,
): boolean {
  if (type.configFields.length === 0) return true;
  return type.configFields
    .filter((f) => f.required)
    .every((f) => Boolean((config[f.key] ?? '').trim()));
}

/**
 * Resolve instance status from config + optional pack health for pack-bound instances.
 */
export function instanceStatus(
  instance: SourceInstance,
  packs: CapabilityPack[],
  type?: SourceTypeDef,
): InstanceStatus {
  const t = type ?? getSourceType(instance.typeId);
  if (!t) return 'needs_setup';

  const formConfigured = instanceConfigComplete(t, instance.config);

  if (!instance.packBound) {
    // Multi-instance not yet on controller — config saved in console only
    if (!formConfigured && t.configFields.length > 0) return 'draft';
    return instance.enabledPermissionIds.length > 0 ? 'connected' : 'ready';
  }

  const boundCaps = t.permissions
    .filter((p) => p.capabilityId)
    .map((p) => packs.find((c) => c.id === p.capabilityId))
    .filter(Boolean) as CapabilityPack[];

  if (boundCaps.length === 0) return 'needs_setup';

  const enabled = boundCaps.filter((c) => c.enabled);
  const anyDown = enabled.some((c) => (c.health?.status ?? 'unknown') === 'down');
  if (anyDown) return 'error';

  const packConfigured = boundCaps.some((c) => c.configured);
  const configured = formConfigured || packConfigured || t.configFields.length === 0;
  if (!configured) return 'needs_setup';

  if (enabled.length === 0) return 'ready';
  return 'connected';
}

export function configSummary(type: SourceTypeDef, config: Record<string, string>): string {
  if (type.id === 'postgresql') {
    const host = config.host || '…';
    const db = config.database || '…';
    const user = config.username || '…';
    return `${user}@${host}/${db}`;
  }
  if (type.id === 'github') {
    return config.owner ? `${config.owner}${config.repos ? ` · ${config.repos}` : ''}` : 'Not configured';
  }
  if (type.id === 'git-local') {
    return config.repoPath || 'No path';
  }
  if (type.id === 'object-storage') {
    return config.bucket ? `s3://${config.bucket}${config.prefix ? '/' + config.prefix : ''}` : 'Not configured';
  }
  if (type.singletonBuiltin) return 'On this appliance';
  const parts = type.configFields
    .filter((f) => !f.secret && config[f.key])
    .map((f) => config[f.key]);
  return parts.join(' · ') || 'Not configured';
}

export function newInstanceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createInstance(
  type: SourceTypeDef,
  partial?: Partial<Pick<SourceInstance, 'displayName' | 'config' | 'groups' | 'packBound'>>,
): SourceInstance {
  const now = new Date().toISOString();
  const packBound =
    partial?.packBound ??
    Boolean(type.singletonBuiltin || !type.multiInstance);
  return {
    id: newInstanceId(),
    typeId: type.id,
    displayName: partial?.displayName ?? type.displayName,
    config: partial?.config ?? {},
    enabledPermissionIds: [],
    groups: partial?.groups ?? (type.singletonBuiltin ? ['Everyone'] : ['Admins']),
    packBound,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seed instances from capability packs (singleton bridge).
 * Multi-instance types get at most one pack-bound instance when a pack exists.
 */
export function seedInstancesFromPacks(packs: CapabilityPack[]): SourceInstance[] {
  const instances: SourceInstance[] = [];
  const now = new Date().toISOString();

  for (const type of SOURCE_TYPES) {
    const capsForType = type.permissions
      .map((p) => (p.capabilityId ? packs.find((c) => c.id === p.capabilityId) : undefined))
      .filter(Boolean) as CapabilityPack[];

    if (type.singletonBuiltin) {
      const enabledIds = type.permissions
        .filter((p) => p.capabilityId && packs.find((c) => c.id === p.capabilityId)?.enabled)
        .map((p) => p.id);
      instances.push({
        id: `builtin-${type.id}`,
        typeId: type.id,
        displayName: type.displayName,
        config: {},
        enabledPermissionIds: enabledIds,
        groups: ['Everyone'],
        packBound: true,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    if (capsForType.length === 0) continue;

    // One pack-bound seed instance when any related pack is configured or present
    const primary = capsForType[0];
    const enabledIds = type.permissions
      .filter((p) => p.capabilityId && packs.find((c) => c.id === p.capabilityId)?.enabled)
      .map((p) => p.id);

    const config: Record<string, string> = {};
    if (type.id === 'postgresql' && primary.configured_detail) {
      // leave empty — detail is free text; admin fills connect form
    }
    if (type.id === 'git-local' || type.id === 'github') {
      // pack may be unconfigured
    }

    // Prefer GitHub as customer surface; skip auto-seed git-local unless developer will add it
    if (type.id === 'git-local') continue;
    if (type.id === 'github' && !packs.some((c) => c.id === 'git.search')) continue;
    if (type.id === 'object-storage' && !packs.some((c) => c.id === 's3.read')) continue;
    if (type.id === 'postgresql' && !packs.some((c) => c.id === 'sql.query')) continue;

    // Only seed github/postgres/s3 if pack exists (we already checked)
    const shouldSeed =
      primary.configured ||
      primary.enabled ||
      type.id === 'postgresql' ||
      type.id === 'github';

    if (!shouldSeed && type.advancedOnly) continue;

    // Seed a pack-bound placeholder so status can show needs_setup / ready
    if (type.id === 'github' || type.id === 'postgresql') {
      // Don't force empty instance into the list until user adds — unless pack enabled/configured
      if (!primary.configured && !primary.enabled) continue;
    }

    instances.push({
      id: `pack-${type.id}`,
      typeId: type.id,
      displayName:
        type.id === 'postgresql'
          ? 'PostgreSQL (appliance)'
          : type.id === 'github'
            ? 'Git (appliance mount)'
            : type.displayName,
      config,
      enabledPermissionIds: enabledIds,
      groups: ['Admins'],
      packBound: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return instances;
}

const STORAGE_KEY = 'ownedge.source_instances.v1';

export function loadStoredInstances(): SourceInstance[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SourceInstance[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredInstances(instances: SourceInstance[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip secret field values before persist? Keep markers only.
    const redacted = instances.map((inst) => {
      const type = getSourceType(inst.typeId);
      const config = { ...inst.config };
      if (type) {
        for (const f of type.configFields) {
          if (f.secret && config[f.key] && config[f.key] !== '••••') {
            // Keep a marker that a secret was provided (actual secret stays in session only)
            config[f.key] = '••••';
          }
        }
      }
      return { ...inst, config };
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(redacted));
  } catch {
    // ignore quota
  }
}

/**
 * Merge stored instances with pack-seeded builtin/pack-bound rows.
 * Stored multi-instance rows win; pack-bound ids are refreshed from packs for enabled flags.
 */
export function mergeInstancesWithPacks(
  stored: SourceInstance[] | null,
  packs: CapabilityPack[],
): SourceInstance[] {
  const seeded = seedInstancesFromPacks(packs);
  if (!stored || stored.length === 0) return seeded;

  const byId = new Map<string, SourceInstance>();
  for (const s of seeded) byId.set(s.id, s);

  for (const s of stored) {
    if (s.id.startsWith('builtin-') || s.id.startsWith('pack-')) {
      // Refresh enabled flags from packs for bound instances
      const type = getSourceType(s.typeId);
      if (type && s.packBound) {
        const enabledIds = type.permissions
          .filter((p) => {
            if (!p.capabilityId) return s.enabledPermissionIds.includes(p.id);
            return packs.find((c) => c.id === p.capabilityId)?.enabled;
          })
          .map((p) => p.id);
        byId.set(s.id, {
          ...s,
          ...byId.get(s.id),
          displayName: s.displayName || byId.get(s.id)?.displayName || s.displayName,
          config: { ...byId.get(s.id)?.config, ...s.config },
          groups: s.groups?.length ? s.groups : byId.get(s.id)?.groups ?? ['Admins'],
          enabledPermissionIds: enabledIds,
          packBound: true,
        });
      } else {
        byId.set(s.id, s);
      }
    } else {
      byId.set(s.id, s);
    }
  }

  // Ensure builtin always present
  for (const s of seeded) {
    if (s.id.startsWith('builtin-') && !byId.has(s.id)) byId.set(s.id, s);
  }

  return Array.from(byId.values()).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.displayName.localeCompare(b.displayName),
  );
}

export function unmappedCapabilities(
  packs: CapabilityPack[],
  types: SourceTypeDef[] = SOURCE_TYPES,
): CapabilityPack[] {
  const known = new Set<string>();
  for (const t of types) {
    for (const p of t.permissions) {
      if (p.capabilityId) known.add(p.capabilityId);
    }
  }
  return packs.filter((p) => !known.has(p.id));
}

/** @deprecated use instanceStatus */
export function connectionStatus(
  packs: CapabilityPack[],
  connector: SourceTypeDef,
): InstanceStatus {
  const fake: SourceInstance = {
    id: 'x',
    typeId: connector.id,
    displayName: connector.displayName,
    config: {},
    enabledPermissionIds: [],
    groups: [],
    packBound: true,
    createdAt: '',
    updatedAt: '',
  };
  // If any permission enabled → connected-ish
  const caps = connector.permissions
    .map((p) => packs.find((c) => c.id === p.capabilityId))
    .filter(Boolean) as CapabilityPack[];
  if (caps.some((c) => c.enabled)) {
    fake.enabledPermissionIds = connector.permissions.map((p) => p.id);
  }
  if (caps.some((c) => c.configured) || connector.configFields.length === 0) {
    for (const f of connector.configFields.filter((x) => x.required)) {
      fake.config[f.key] = 'set';
    }
  }
  return instanceStatus(fake, packs, connector);
}

export function lookupCapability(capabilityId: string) {
  for (const connector of SOURCE_TYPES) {
    const permission = connector.permissions.find((p) => p.capabilityId === capabilityId);
    if (permission) return { connector, permission };
  }
  return undefined;
}

export const SECTION_META: Record<
  SourceSection,
  { title: string; description: string }
> = {
  builtin: {
    title: 'On this appliance',
    description: 'Built-in knowledge that lives on this appliance.',
  },
  apps: {
    title: 'Your systems',
    description:
      'Connected applications and databases. Add multiple instances of the same type when you need separate credentials, roles, or scopes.',
  },
  advanced: {
    title: 'Advanced',
    description: 'Low-level adapters for operators. Prefer application sources when available.',
  },
};

/** Alias for older imports */
export type ConnectorDef = SourceTypeDef;
export type ConnectorSection = SourceSection;
export type PermissionMeta = PermissionTemplate;
