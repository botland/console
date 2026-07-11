import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as runtime from '@/lib/runtime';
import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/status/route';

describe('GET /api/status', () => {
  beforeEach(() => resetStore());

  it('returns status and config', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state).toBe('READY');
    expect(body.config.version).toBe(2);
    expect(body.head.head_node_id).toBe('node-1');
    expect(body.gateway.is_head).toBe(true);
    expect(body.gateway.local_node_id).toBe('node-1');
  });

  it('returns 200 with status when config load fails', async () => {
    vi.spyOn(runtime, 'getConfig').mockRejectedValueOnce(new Error('Invalid appliance configuration'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.state).toBe('READY');
    expect(body.config).toBeNull();
    expect(body.config_error).toBe('Invalid appliance configuration');
    expect(body.events).toBeDefined();
  });
});