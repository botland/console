import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/storage/route';

describe('GET /api/storage', () => {
  beforeEach(() => resetStore());

  it('returns usage and mounts', async () => {
    const res = await GET(new Request("http://localhost"));
    const body = await res.json();
    expect(body.total_bytes).toBeGreaterThan(0);
    expect(body.mounts).toHaveLength(1);
    expect(body.paths['/models/hf-cache']).toBeDefined();
  });
});