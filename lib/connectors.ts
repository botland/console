/**
 * Customer-facing information sources presentation.
 *
 * Admins enable/disable sources (and permissions). Capability packs, MCP servers,
 * tool names, and risk_class remain internal platform representations.
 */

import type { CapabilityPack } from '@/lib/types';

export type ConnectorSection = 'builtin' | 'apps' | 'advanced';

export type TrustKind = 'read' | 'create' | 'propose' | 'high_impact';

export interface PermissionMeta {
  capabilityId: string;
  label: string;
  description: string;
  trust: TrustKind;
  /** Human bullets — what the AI can do (never raw tool names). */
  canDo: string[];
}

export interface ConnectorDef {
  id: string;
  section: ConnectorSection;
  displayName: string;
  summary: string;
  /** Primary permission drives "Connected" for single-cap connectors. */
  permissions: PermissionMeta[];
  /** When true, only shown with Developer / Advanced mode on. */
  advancedOnly?: boolean;
  /** Optional roadmap note under the card. */
  roadmapNote?: string;
}

/** Static product catalog. Capability ids must match controller catalog. */
export const CONNECTOR_DEFS: ConnectorDef[] = [
  {
    id: 'appliance-knowledge',
    section: 'builtin',
    displayName: 'Appliance knowledge',
    summary:
      'On-box documentation the AI can search. Your data is never modified unless you enable a permission that requires approval.',
    permissions: [
      {
        capabilityId: 'knowledge.search',
        label: 'Search & answer',
        description: 'Read-only access so the AI can answer from your documentation.',
        trust: 'read',
        canDo: ['Search documentation', 'Read documents', 'Answer questions from the corpus'],
      },
      {
        capabilityId: 'knowledge.propose_edit',
        label: 'Suggest edits',
        description: 'AI can prepare documentation edits. Nothing applies without your approval.',
        trust: 'propose',
        canDo: ['Propose documentation edits', 'Preview changes before approval'],
      },
      {
        capabilityId: 'notes.create',
        label: 'Create draft notes',
        description: 'AI can create new draft notes only. Existing documents are never modified.',
        trust: 'create',
        canDo: ['Create new draft notes', 'List draft notes'],
      },
      {
        capabilityId: 'knowledge.propose_archive',
        label: 'Propose move to trash',
        description:
          'AI can propose moving staging files to trash. Always needs your confirmation. Not permanent delete.',
        trust: 'high_impact',
        canDo: ['Propose soft-archive to trash', 'Preview before approval'],
      },
    ],
  },
  {
    id: 'git',
    section: 'apps',
    displayName: 'Git repository',
    summary:
      'Let the AI answer questions about source code (history, files, search). Read-only — no push or rewrite.',
    permissions: [
      {
        capabilityId: 'git.search',
        label: 'Read repository',
        description: 'Search commits, refs, and files. Never writes or pushes.',
        trust: 'read',
        canDo: ['List branches and tags', 'Search commit history', 'Read and search files'],
      },
    ],
    roadmapNote: 'Later: connect GitHub or GitLab with sign-in.',
  },
  {
    id: 'postgresql',
    section: 'apps',
    displayName: 'PostgreSQL',
    summary:
      'Read-only access to a PostgreSQL database so the AI can answer questions from your data. Writes and schema changes are blocked.',
    permissions: [
      {
        capabilityId: 'sql.query',
        label: 'Read-only queries',
        description:
          'List tables, describe schema, and run SELECT queries. No INSERT/UPDATE/DELETE/DDL.',
        trust: 'read',
        canDo: ['List tables and views', 'Describe columns', 'Run read-only SQL (SELECT)'],
      },
    ],
    roadmapNote:
      'Connect a database on the appliance when ready. Needs setup until a database is linked. SQLite demos stay in Developer mode only.',
  },
  {
    id: 'object-storage',
    section: 'advanced',
    displayName: 'Object storage',
    summary:
      'Low-level S3-compatible object access. Most teams should connect SharePoint, OneDrive, or Google Drive instead when available.',
    advancedOnly: true,
    permissions: [
      {
        capabilityId: 's3.read',
        label: 'List & read objects',
        description: 'Read-only list and get from a bucket prefix. No upload or delete.',
        trust: 'read',
        canDo: ['List objects', 'Read object contents'],
      },
    ],
  },
];

/** Placeholder enterprise apps (no backend capability yet). */
export const COMING_SOON_CONNECTORS: {
  id: string;
  displayName: string;
  summary: string;
}[] = [
  {
    id: 'microsoft-365',
    displayName: 'Microsoft 365',
    summary: 'SharePoint, OneDrive, Outlook, Teams — planned.',
  },
  {
    id: 'atlassian',
    displayName: 'Atlassian',
    summary: 'Confluence and Jira — planned.',
  },
  {
    id: 'google-workspace',
    displayName: 'Google Workspace',
    summary: 'Drive, Gmail, Calendar — planned.',
  },
  {
    id: 'mysql-ldap',
    displayName: 'MySQL & LDAP',
    summary: 'Additional enterprise data systems — planned after PostgreSQL.',
  },
];

const CAP_TO_CONNECTOR = new Map<string, { connector: ConnectorDef; permission: PermissionMeta }>();
for (const c of CONNECTOR_DEFS) {
  for (const p of c.permissions) {
    CAP_TO_CONNECTOR.set(p.capabilityId, { connector: c, permission: p });
  }
}

export function lookupCapability(capabilityId: string) {
  return CAP_TO_CONNECTOR.get(capabilityId);
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

export function connectionStatus(
  packs: CapabilityPack[],
  connector: ConnectorDef,
): 'connected' | 'partial' | 'ready' | 'needs_setup' | 'error' {
  const relevant = connector.permissions
    .map((p) => packs.find((c) => c.id === p.capabilityId))
    .filter(Boolean) as CapabilityPack[];
  if (relevant.length === 0) return 'needs_setup';

  const enabled = relevant.filter((c) => c.enabled);
  const anyDown = enabled.some((c) => (c.health?.status ?? 'unknown') === 'down');
  if (anyDown) return 'error';

  if (enabled.length === 0) {
    const anyConfigured = relevant.some((c) => c.configured);
    return anyConfigured ? 'ready' : 'needs_setup';
  }

  if (enabled.length < relevant.length && relevant.length > 1) return 'partial';

  const primary = enabled[0];
  if (primary && !primary.configured) return 'needs_setup';
  return 'connected';
}

export function statusLabel(status: ReturnType<typeof connectionStatus>): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'partial':
      return 'Partially enabled';
    case 'ready':
      return 'Ready to enable';
    case 'needs_setup':
      return 'Needs setup';
    case 'error':
      return 'Unavailable';
  }
}

export function statusDotClass(status: ReturnType<typeof connectionStatus>): string {
  switch (status) {
    case 'connected':
    case 'partial':
      return 'bg-emerald-400';
    case 'ready':
      return 'bg-sky-400';
    case 'needs_setup':
      return 'bg-amber-400';
    case 'error':
      return 'bg-rose-400';
  }
}

export function enableConfirmMessage(permission: PermissionMeta): string | null {
  if (permission.trust === 'read') return null;
  if (permission.trust === 'create') {
    return `${permission.label}: the AI may create new items only. Existing data is not modified. Continue?`;
  }
  if (permission.trust === 'propose') {
    return `${permission.label}: the AI may propose changes. Nothing is applied without your approval. Continue?`;
  }
  return `${permission.label}: the AI may propose high-impact actions. You must always confirm before anything applies. Continue?`;
}

export function unmappedCapabilities(packs: CapabilityPack[]): CapabilityPack[] {
  return packs.filter((p) => !CAP_TO_CONNECTOR.has(p.id));
}

export const SECTION_META: Record<
  ConnectorSection,
  { title: string; description: string }
> = {
  builtin: {
    title: 'On this appliance',
    description: 'Knowledge that lives on this appliance.',
  },
  apps: {
    title: 'Your systems',
    description: 'Applications and databases the AI may use to answer questions.',
  },
  advanced: {
    title: 'Advanced',
    description:
      'Low-level adapters for operators. Prefer application and database sources when available.',
  },
};
