import { NextRequest, NextResponse } from 'next/server';

import { putHfToken } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as { token?: unknown };
    if (body.token !== undefined && typeof body.token !== 'string') {
      return NextResponse.json({ error: 'token must be a string' }, { status: 400 });
    }
    const result = await putHfToken(typeof body.token === 'string' ? body.token : '');
    return NextResponse.json(result);
  });
}
