import { NextRequest, NextResponse } from 'next/server';

import { detachFromCluster } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    try {
      const result = await detachFromCluster();
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detach failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}