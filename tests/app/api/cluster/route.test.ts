import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET, PUT } from '@/app/api/cluster/route';

describe('/api/cluster', () => {
  beforeEach(() => {
    resetStore();
    vi.useRealTimers();
  });

  it('GET returns cluster config', async () => {
    const res = await GET();
    expect((await res.json()).head_node_id).toBe('node-1');
  });

  it('PUT updates cluster settings', async () => {
    const req = new NextRequest('http://localhost/api/cluster', {
      method: 'PUT',
      body: JSON.stringify({
        serving_mode: 'distributed',
        head_node_id: 'node-1',
        head_epoch: 1,
        global_defaults: { autoscale_enabled: false },
      }),
    });
    const res = await PUT(req);
    expect((await res.json()).global_defaults.autoscale_enabled).toBe(false);
  });
});