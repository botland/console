import { describe, expect, it } from 'vitest';
import {
  CONNECTOR_DEFS,
  connectionStatus,
  enableConfirmMessage,
  lookupCapability,
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

describe('connectors presentation', () => {
  it('maps capabilities to connectors (packs stay internal)', () => {
    const hit = lookupCapability('knowledge.search');
    expect(hit?.connector.id).toBe('appliance-knowledge');
    expect(hit?.permission.trust).toBe('read');
    expect(lookupCapability('sql.query')?.connector.id).toBe('postgresql');
  });

  it('treats PostgreSQL as a primary application source', () => {
    const pg = CONNECTOR_DEFS.find((c) => c.id === 'postgresql');
    expect(pg?.section).toBe('apps');
    expect(pg?.advancedOnly).toBeFalsy();
    expect(lookupCapability('sql.query')?.connector.id).toBe('postgresql');
  });

  it('computes connection status from enabled permissions', () => {
    const packs = [
      pack({ id: 'git.search', enabled: true, configured: true, health: { status: 'up' } }),
    ];
    const git = CONNECTOR_DEFS.find((c) => c.id === 'git')!;
    expect(connectionStatus(packs, git)).toBe('connected');
    expect(connectionStatus([pack({ id: 'git.search', enabled: false, configured: true })], git)).toBe(
      'ready',
    );
  });

  it('requires confirm copy for non-read enables', () => {
    const propose = lookupCapability('knowledge.propose_edit')!.permission;
    expect(enableConfirmMessage(propose)).toMatch(/approval/i);
    const read = lookupCapability('knowledge.search')!.permission;
    expect(enableConfirmMessage(read)).toBeNull();
    expect(trustLabel('high_impact')).toMatch(/confirm/i);
  });

  it('lists unmapped capabilities', () => {
    const packs = [pack({ id: 'future.connector' }), pack({ id: 'git.search' })];
    expect(unmappedCapabilities(packs).map((p) => p.id)).toEqual(['future.connector']);
  });
});
