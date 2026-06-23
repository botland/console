import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig, updateCluster } from '@/lib/mock/store';
import type { ClusterConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(getConfig().cluster));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as ClusterConfig;
    const config = updateCluster(body);
    return NextResponse.json(config.cluster);
  });
}