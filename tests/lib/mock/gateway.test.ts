import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import {
  COORDINATOR_HEADER,
  getGatewayInfo,
  getHeadApiBase,
  isCoordinatorRequest,
  runWithHeadAuthority,
} from '@/lib/mock/gateway';
import { getConfig, resetTestState } from '@/lib/mock/store';

describe('gateway', () => {
  beforeEach(() => {
    resetStore();
    delete process.env.APPLIANCE_LOCAL_NODE_ID;
  });

  afterEach(() => {
    delete process.env.APPLIANCE_LOCAL_NODE_ID;
    delete process.env.APPLIANCE_HEAD_INTERNAL_URL;
    vi.restoreAllMocks();
  });

  it('detects coordinator requests', () => {
    const req = new Request('http://localhost', {
      headers: { [COORDINATOR_HEADER]: 'true' },
    });
    expect(isCoordinatorRequest(req)).toBe(true);
    expect(isCoordinatorRequest(new Request('http://localhost'))).toBe(false);
  });

  it('reports head gateway info on head node', async () => {
    const info = await getGatewayInfo();
    expect(info.is_head).toBe(true);
    expect(info.local_node_id).toBe('node-1');
    expect(info.head_api_url).toContain('192.168.1.10');
  });

  it('reports worker role when local node is not head', async () => {
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });
    const info = await getGatewayInfo();
    expect(info.is_head).toBe(false);
    expect(info.local_node_id).toBe('node-2');
  });

  it('always runs handler locally (no head console proxy)', async () => {
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });
    const handler = vi.fn(async () => new Response('local'));
    const res = await runWithHeadAuthority(new Request('http://localhost/api/nodes'), handler);
    expect(handler).toHaveBeenCalled();
    expect(await res.text()).toBe('local');
  });

  it('uses custom head internal url', async () => {
    process.env.APPLIANCE_HEAD_INTERNAL_URL = 'http://10.0.0.99:4000';
    expect(await getHeadApiBase()).toBe('http://10.0.0.99:4000');
    await getConfig();
  });
});