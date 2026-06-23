import type { NextRequest } from 'next/server';
import { NextRequest as NextRequestCtor } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { minimalConfig } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { POST } from '@/app/api/import/route';

describe('POST /api/import', () => {
  beforeEach(() => resetStore());

  it('imports valid config', async () => {
    const req = new NextRequestCtor('http://localhost/api/import', {
      method: 'POST',
      body: JSON.stringify(minimalConfig({ appliance_id: 'imported' })),
    });
    const res = await POST(req);
    expect((await res.json()).applied).toBe(true);
  });

  it('rejects invalid config', async () => {
    const req = new NextRequestCtor('http://localhost/api/import', {
      method: 'POST',
      body: JSON.stringify({ invalid: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).applied).toBe(false);
  });

  it('returns generic error for non-Error failures', async () => {
    const req = {
      json: async () => {
        throw 'boom';
      },
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON');
  });
});