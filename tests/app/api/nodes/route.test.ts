import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/nodes/route';

describe('GET /api/nodes', () => {
  beforeEach(() => resetStore());

  it('lists nodes', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(3);
    expect(body[0].hostname).toBeTruthy();
  });
});