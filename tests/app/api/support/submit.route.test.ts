import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/support/submit/route';
import { resetTestState } from '@/lib/runtime';

describe('POST /api/support/submit', () => {
  beforeEach(() => {
    resetTestState();
    vi.stubEnv('SUPPORT_ENABLED', 'true');
    vi.stubEnv('SUPPORT_SERVICE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a diagnostic report in mock mode', async () => {
    const req = new NextRequest('http://localhost/api/support/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_note: 'Model failed after migration' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ticket_id).toBeTruthy();
    expect(body.status).toBe('queued');
  });
});