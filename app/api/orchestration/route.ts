import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import { getOrchestration, putOrchestration } from '@/lib/runtime';
import type { ClusterConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await getOrchestration()));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as ClusterConfig;
    return NextResponse.json(await putOrchestration(body));
  });
}