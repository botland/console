import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { PUT } from '@/app/api/nodes/[id]/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PUT /api/nodes/[id]', () => {
  beforeEach(() => resetStore());

  it('updates node or returns 404', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ labels: ['updated'] }),
    });
    const res = await PUT(req, params('node-2'));
    expect((await res.json()).labels).toContain('updated');

    const missingReq = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ labels: ['updated'] }),
    });
    const missing = await PUT(missingReq, params('missing'));
    expect(missing.status).toBe(404);
  });
});