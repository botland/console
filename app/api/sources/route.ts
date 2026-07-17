import { NextResponse } from 'next/server';

import { createSource, listSources } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await listSources()));
}

export async function POST(req: Request) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(await createSource(body));
  });
}
