import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { sampleDeployment } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { GET, POST } from '@/app/api/deployments/route';

describe('/api/deployments', () => {
  beforeEach(() => resetStore());

  it('lists deployments', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.length).toBe(2);
  });

  it('creates a deployment', async () => {
    const dep = sampleDeployment({ id: 'dep-created' });
    const req = new NextRequest('http://localhost/api/deployments', {
      method: 'POST',
      body: JSON.stringify(dep),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe('dep-created');
  });
});