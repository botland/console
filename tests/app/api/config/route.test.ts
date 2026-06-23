import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { minimalConfig } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { GET, PUT } from '@/app/api/config/route';

describe('/api/config', () => {
  beforeEach(() => resetStore());

  it('GET returns current config', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.version).toBe(2);
  });

  it('PUT updates config', async () => {
    const config = minimalConfig({ appliance_id: 'via-api' });
    const req = new NextRequest('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect((await res.json()).appliance_id).toBe('via-api');
  });

  it('PUT rejects invalid config', async () => {
    const req = new NextRequest('http://localhost/api/config', {
      method: 'PUT',
      body: JSON.stringify({ bad: true }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid');
  });

  it('PUT returns generic message for non-Error failures', async () => {
    const req = {
      json: async () => {
        throw 'boom';
      },
    } as unknown as NextRequest;
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid config');
  });
});