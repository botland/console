import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { POST } from '@/app/api/storage/mounts/route';

describe('POST /api/storage/mounts', () => {
  beforeEach(() => resetStore());

  it('adds a storage mount', async () => {
    const req = new NextRequest('http://localhost/api/storage/mounts', {
      method: 'POST',
      body: JSON.stringify({
        type: 'nfs',
        remote: '10.0.0.9:/vol',
        local_path: '/mnt/vol',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.local_path).toBe('/mnt/vol');
    expect(body.id).toMatch(/^mount-/);
  });
});