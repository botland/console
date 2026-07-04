import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import { getOrchestration, updateOrchestration } from '@/lib/runtime';
import type { ClusterConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await getOrchestration()));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as ClusterConfig;
    const config = await updateOrchestration(body);
    return NextResponse.json(config.cluster);
  });
}