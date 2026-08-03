import { NextRequest, NextResponse } from 'next/server';

import { getIdentity, putIdentity } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await getIdentity()));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'JSON object required' }, { status: 400 });
    }
    try {
      return NextResponse.json(await putIdentity(body as Record<string, unknown>));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save identity';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
