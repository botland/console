import { NextRequest, NextResponse } from 'next/server';

import { putPlatformRag } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { RagConfig } from '@/lib/types';

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as RagConfig;
    return NextResponse.json(await putPlatformRag(body));
  });
}
