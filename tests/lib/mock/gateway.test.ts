import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import {
  COORDINATOR_HEADER,
  getGatewayInfo,
  getHeadApiBase,
  isCoordinatorRequest,
  proxyToHead,
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

  it('reports head gateway info on head node', () => {
    const info = getGatewayInfo();
    expect(info.is_head).toBe(true);
    expect(info.local_node_id).toBe('node-1');
    expect(info.head_api_url).toContain('192.168.1.10');
  });

  it('reports worker role when local node is not head', () => {
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });
    const info = getGatewayInfo();
    expect(info.is_head).toBe(false);
    expect(info.local_node_id).toBe('node-2');
  });

  it('runs handler locally on head coordinator', async () => {
    const handler = vi.fn(async () => new Response('ok'));
    const res = await runWithHeadAuthority(new Request('http://localhost/api/status'), handler);
    expect(handler).toHaveBeenCalled();
    expect(await res.text()).toBe('ok');
  });

  it('delegates to handler on worker when internal proxy is enabled', async () => {
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });
    const handler = vi.fn(async () => new Response('proxied'));
    const res = await runWithHeadAuthority(new Request('http://localhost/api/nodes'), handler);
    expect(handler).toHaveBeenCalled();
    expect(await res.text()).toBe('proxied');
  });

  it('proxies to head over fetch when internal mode is disabled', async () => {
    delete process.env.APPLIANCE_GATEWAY_INTERNAL;
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    const res = await proxyToHead(new Request('http://localhost:3000/api/nodes'));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`${getHeadApiBase()}/api/nodes`),
      expect.objectContaining({ method: 'GET' }),
    );
    expect((await res.json()).ok).toBe(true);
  });

  it('forwards mutation bodies when proxying to head', async () => {
    delete process.env.APPLIANCE_GATEWAY_INTERNAL;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );

    await proxyToHead(
      new Request('http://localhost:3000/api/config', {
        method: 'PUT',
        body: JSON.stringify({ version: 2 }),
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT', body: expect.any(ReadableStream) }),
    );
  });

  it('rethrows unexpected proxy failures', async () => {
    delete process.env.APPLIANCE_GATEWAY_INTERNAL;
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      runWithHeadAuthority(new Request('http://localhost/api/nodes'), async () => new Response('x')),
    ).rejects.toThrow('network down');
  });

  it('proxies worker requests via fetch when internal mode is off', async () => {
    delete process.env.APPLIANCE_GATEWAY_INTERNAL;
    process.env.APPLIANCE_LOCAL_NODE_ID = 'node-2';
    resetTestState({ seed: true, clearDisk: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('remote', { status: 200 })),
    );

    const handler = vi.fn(async () => new Response('local'));
    const res = await runWithHeadAuthority(new Request('http://localhost/api/nodes'), handler);
    expect(handler).not.toHaveBeenCalled();
    expect(await res.text()).toBe('remote');
  });

  it('uses custom head internal url', () => {
    process.env.APPLIANCE_HEAD_INTERNAL_URL = 'http://10.0.0.99:4000';
    expect(getHeadApiBase()).toBe('http://10.0.0.99:4000');
    void getConfig();
  });
});