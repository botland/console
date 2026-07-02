import { NextRequest, NextResponse } from 'next/server';

import { createDeployment, listDeployments } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { DeploymentConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await listDeployments()));
}

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as DeploymentConfig;
    const dep = await createDeployment(body);
    return NextResponse.json(dep, { status: 201 });
  });
}