import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/support/tickets/route';
import { resetTestState } from '@/lib/runtime';

describe('GET /api/support/tickets', () => {
  beforeEach(() => {
    resetTestState();
    vi.stubEnv('SUPPORT_ENABLED', 'true');
    vi.stubEnv('SUPPORT_SERVICE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an empty ticket list initially', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appliance_id).toBeTruthy();
    expect(body.tickets).toEqual([]);
  });
});