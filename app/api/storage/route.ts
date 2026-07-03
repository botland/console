import { NextResponse } from 'next/server';

import { getConfig, getStorage } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => {
    const usage = await getStorage();
    const mounts = (await getConfig()).storage.mounts;
    return NextResponse.json({ ...usage, mounts });
  });
}