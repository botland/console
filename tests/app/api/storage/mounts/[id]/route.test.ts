import { beforeEach, describe, expect, it } from 'vitest';

import { resetStore } from '@/tests/helpers/store';

import { DELETE } from '@/app/api/storage/mounts/[id]/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('DELETE /api/storage/mounts/[id]', () => {
  beforeEach(() => resetStore());

  it('removes mount by id', async () => {
    const res = await DELETE(new Request('http://localhost'), params('mount-nfs-1'));
    expect((await res.json()).deleted).toBe(true);
  });

  it('returns deleted false for unknown mount', async () => {
    const res = await DELETE(new Request('http://localhost'), params('missing'));
    expect((await res.json()).deleted).toBe(false);
  });
});