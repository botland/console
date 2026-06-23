import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';
import { updateNode } from '@/lib/mock/store';

import { POST } from '@/app/api/cluster/migrate-head/route';

describe('POST /api/cluster/migrate-head', () => {
  beforeEach(() => resetStore());

  it('requires head_node_id', async () => {
    const req = new NextRequest('http://localhost/api/cluster/migrate-head', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('migrates head successfully', async () => {
    const req = new NextRequest('http://localhost/api/cluster/migrate-head', {
      method: 'POST',
      body: JSON.stringify({ head_node_id: 'node-2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 when migration fails', async () => {
    updateNode('node-2', { status: 'offline' });
    const req = new NextRequest('http://localhost/api/cluster/migrate-head', {
      method: 'POST',
      body: JSON.stringify({ head_node_id: 'node-2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('online');
  });
});