import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/status/route';

describe('GET /api/status', () => {
  beforeEach(() => resetStore());

  it('returns status and config', async () => {
    const res = await GET(new Request("http://localhost"));
    const body = await res.json();
    expect(body.state).toBe('READY');
    expect(body.config.version).toBe(2);
    expect(body.head.head_node_id).toBe('node-1');
    expect(body.gateway.is_head).toBe(true);
    expect(body.gateway.local_node_id).toBe('node-1');
  });
});