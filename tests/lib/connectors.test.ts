import { describe, expect, it } from 'vitest';
import {
  SOURCE_TYPES,
  createInstance,
  enableConfirmMessage,
  instanceConfigComplete,
  instanceStatus,
  lookupCapability,
  normalizeSourceInstance,
  seedInstancesFromPacks,
  trustLabel,
  unmappedCapabilities,
} from '@/lib/connectors';
import type { CapabilityPack } from '@/lib/types';

function pack(partial: Partial<CapabilityPack> & { id: string }): CapabilityPack {
  return {
    description: '',
    enabled: false,
    pack: 'p',
    pack_version: '1',
    mcp_server: 'm',
    allowed_tools: [],
    docs: '',
    health: { status: 'up' },
    configured: true,
    configured_detail: '',
    read_only: true,
    ...partial,
  };
}

describe('source types and instances', () => {
  it('maps capabilities to source types (packs stay internal)', () => {
    const hit = lookupCapability('corpus.read');
    expect(hit?.connector.id).toBe('appliance-knowledge');
    expect(hit?.permission.trust).toBe('read');
    expect(lookupCapability('sql.query')?.connector.id).toBe('postgresql');
  });

  it('normalizes controller source registry rows', () => {
    const inst = normalizeSourceInstance({
      id: 'finance-db',
      type_id: 'postgresql',
      display_name: 'Finance',
      config: { database: 'inv' },
      enabled_permission_ids: ['read'],
      groups: ['finance'],
      pack_bound: false,
      created_at: 't0',
      updated_at: 't1',
      resourceUri: 'sql://finance-db/inv',
    });
    expect(inst.typeId).toBe('postgresql');
    expect(inst.displayName).toBe('Finance');
    expect(inst.enabledPermissionIds).toEqual(['read']);
    expect(inst.packBound).toBe(false);
  });

  it('treats PostgreSQL and GitHub as multi-instance application sources', () => {
    const pg = SOURCE_TYPES.find((c) => c.id === 'postgresql');
    const gh = SOURCE_TYPES.find((c) => c.id === 'github');
    expect(pg?.section).toBe('apps');
    expect(pg?.multiInstance).toBe(true);
    expect(pg?.advancedOnly).toBeFalsy();
    expect(gh?.multiInstance).toBe(true);
    expect(pg?.configFields.some((f) => f.key === 'password' && f.secret)).toBe(true);
  });

  it('requires connection fields before an instance is complete', () => {
    const pg = SOURCE_TYPES.find((c) => c.id === 'postgresql')!;
    expect(instanceConfigComplete(pg, {})).toBe(false);
    expect(
      instanceConfigComplete(pg, {
        host: 'db.local',
        database: 'app',
        username: 'ro',
        password: 'secret',
      }),
    ).toBe(true);
  });

  it('allows multiple named instances of the same type', () => {
    const pg = SOURCE_TYPES.find((c) => c.id === 'postgresql')!;
    const a = createInstance(pg, {
      displayName: 'Prod analytics RO',
      packBound: true,
      config: {
        host: 'a',
        database: 'analytics',
        username: 'ro',
        password: 'x',
      },
    });
    const b = createInstance(pg, {
      displayName: 'HR DB RO',
      packBound: false,
      config: {
        host: 'b',
        database: 'hr',
        username: 'ro',
        password: 'y',
      },
      groups: ['Analysts'],
    });
    expect(a.typeId).toBe(b.typeId);
    expect(a.id).not.toBe(b.id);
    expect(a.displayName).not.toBe(b.displayName);
    expect(b.groups).toEqual(['Analysts']);
    expect(b.packBound).toBe(false);
  });

  it('computes instance status from config and pack health', () => {
    const gitType = SOURCE_TYPES.find((c) => c.id === 'github')!;
    const connectedPacks = [
      pack({ id: 'git.search', enabled: true, configured: true, health: { status: 'up' } }),
    ];
    const inst = createInstance(gitType, {
      packBound: true,
      config: { owner: 'acme', token: '••••' },
    });
    inst.enabledPermissionIds = ['read'];
    expect(instanceStatus(inst, connectedPacks, gitType)).toBe('connected');

    // Pack configured but permission not enabled → ready
    const readyPacks = [
      pack({ id: 'git.search', enabled: false, configured: true, health: { status: 'up' } }),
    ];
    const empty = createInstance(gitType, { packBound: true, config: {} });
    expect(instanceStatus(empty, readyPacks, gitType)).toBe('ready');

    // Unconfigured pack + empty form → needs setup
    const unconfiguredPacks = [
      pack({ id: 'git.search', enabled: false, configured: false }),
    ];
    expect(instanceStatus(empty, unconfiguredPacks, gitType)).toBe('needs_setup');
  });

  it('seeds builtin knowledge from packs', () => {
    const packs = [
      pack({ id: 'corpus.read', enabled: true }),
      pack({ id: 'git.search', enabled: false, configured: false }),
    ];
    const seeded = seedInstancesFromPacks(packs);
    const knowledge = seeded.find((i) => i.typeId === 'appliance-knowledge');
    expect(knowledge?.packBound).toBe(true);
    expect(knowledge?.enabledPermissionIds).toContain('read');
  });

  it('requires confirm copy for non-read enables', () => {
    const propose = lookupCapability('corpus.propose_write')!.permission;
    expect(enableConfirmMessage(propose)).toMatch(/approval/i);
    const read = lookupCapability('corpus.read')!.permission;
    expect(enableConfirmMessage(read)).toBeNull();
    expect(trustLabel('high_impact')).toMatch(/confirm/i);
  });

  it('lists unmapped capabilities', () => {
    const packs = [pack({ id: 'future.connector' }), pack({ id: 'git.search' })];
    expect(unmappedCapabilities(packs).map((p) => p.id)).toEqual(['future.connector']);
  });
});
