import { NextRequest, NextResponse } from 'next/server';

import { getConfig, updateCluster } from '@/lib/mock/store';
import type { ClusterConfig } from '@/lib/types';

export async function GET() {
  return NextResponse.json(getConfig().cluster);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as ClusterConfig;
  const config = updateCluster(body);
  return NextResponse.json(config.cluster);
}