import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { GET } from '@/app/api/config/export/route';

describe('GET /api/config/export', () => {
  beforeEach(() => resetStore());

  it('exports sorted conf.json attachment', async () => {
    const res = await GET();
    expect(res.headers.get('Content-Disposition')).toContain('conf.json');
    const body = await res.text();
    const parsed = JSON.parse(body) as { appliance_id: string; version: number };
    expect(parsed.version).toBe(2);
    expect(parsed.appliance_id).toBeTruthy();
    expect(body.indexOf('"appliance_id"')).toBeLessThan(body.indexOf('"cluster"'));
  });
});