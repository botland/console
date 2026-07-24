import { NextRequest, NextResponse } from 'next/server';

import { getPlatformRagHealth } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    return NextResponse.json(await getPlatformRagHealth());
  });
}
