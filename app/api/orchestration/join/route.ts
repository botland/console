import { NextRequest, NextResponse } from 'next/server';

import { joinCluster } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as { coordinator_address?: string };
    const address = body.coordinator_address?.trim();
    if (!address) {
      return NextResponse.json({ error: 'coordinator_address is required' }, { status: 400 });
    }
    try {
      const result = await joinCluster(address);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Join failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}