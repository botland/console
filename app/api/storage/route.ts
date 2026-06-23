import { NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig, getStorage } from '@/lib/mock/store';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => {
    const usage = getStorage();
    const mounts = getConfig().storage.mounts;
    return NextResponse.json({ ...usage, mounts });
  });
}