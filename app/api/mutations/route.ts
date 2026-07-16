import { NextRequest, NextResponse } from 'next/server';

import { listPendingChanges } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const status = req.nextUrl.searchParams.get('status') ?? 'pending';
    return NextResponse.json(await listPendingChanges(status));
  });
}
