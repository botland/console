import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { sampleDeployment } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import { POST } from '@/app/api/deployments/validate/route';

describe('POST /api/deployments/validate', () => {
  beforeEach(() => resetStore());

  it('validates deployment feasibility', async () => {
    const req = new NextRequest('http://localhost/api/deployments/validate', {
      method: 'POST',
      body: JSON.stringify(sampleDeployment()),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.inventory.available_gpu_count).toBeGreaterThan(0);
  });
});