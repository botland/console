import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { sampleDeployment } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { DELETE, GET, PUT } from '@/app/api/deployments/[id]/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/deployments/[id]', () => {
  beforeEach(() => resetStore());

  it('GET returns deployment or 404', async () => {
    const ok = await GET(new Request('http://localhost'), params('dep-qwen-32b'));
    expect((await ok.json()).id).toBe('dep-qwen-32b');

    const missing = await GET(new Request('http://localhost'), params('missing'));
    expect(missing.status).toBe(404);
  });

  it('PUT updates deployment or returns 404', async () => {
    const dep = sampleDeployment({ id: 'dep-qwen-32b', display_name: 'updated-name' });
    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify(dep),
    });
    const res = await PUT(req, params('dep-qwen-32b'));
    expect((await res.json()).display_name).toBe('updated-name');

    const missingReq = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify(dep),
    });
    const missing = await PUT(missingReq, params('missing'));
    expect(missing.status).toBe(404);
  });

  it('DELETE removes deployment', async () => {
    const res = await DELETE(new Request('http://localhost'), params('dep-llama-8b'));
    expect((await res.json()).deleted).toBe(true);
  });
});