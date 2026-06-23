import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig, updateSystem } from '@/lib/mock/store';
import type { SystemConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(getConfig().system));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as SystemConfig;
    const config = updateSystem(body);
    return NextResponse.json(config.system);
  });
}