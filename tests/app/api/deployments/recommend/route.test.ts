import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { sampleDeployment } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { POST } from '@/app/api/deployments/recommend/route';

describe('POST /api/deployments/recommend', () => {
  beforeEach(() => resetStore());

  it('returns planner recommendation', async () => {
    const req = new NextRequest('http://localhost/api/deployments/recommend', {
      method: 'POST',
      body: JSON.stringify(sampleDeployment()),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.instances).toBeGreaterThanOrEqual(1);
    expect(body.gpus_per_instance).toBeGreaterThanOrEqual(1);
  });
});