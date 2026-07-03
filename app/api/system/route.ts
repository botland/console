import { NextRequest, NextResponse } from 'next/server';

import { getConfig, updateSystem } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { SystemConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json((await getConfig()).system));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as SystemConfig;
    const config = await updateSystem(body);
    return NextResponse.json(config.system);
  });
}