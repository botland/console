import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';
import { getConfig } from '@/lib/mock/store';

import { GET, PUT } from '@/app/api/system/route';

describe('/api/system', () => {
  beforeEach(() => resetStore());

  it('GET returns system config', async () => {
    const res = await GET();
    expect((await res.json()).network.gateway).toBeTruthy();
  });

  it('PUT updates system config', async () => {
    const system = getConfig().system;
    const req = new NextRequest('http://localhost/api/system', {
      method: 'PUT',
      body: JSON.stringify({
        ...system,
        security: { api_token_set: false },
      }),
    });
    const res = await PUT(req);
    expect((await res.json()).security.api_token_set).toBe(false);
  });
});