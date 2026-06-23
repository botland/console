import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { createDeployment, listDeployments } from '@/lib/mock/store';
import type { DeploymentConfig } from '@/lib/types';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(listDeployments()));
}

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as DeploymentConfig;
    const dep = createDeployment(body);
    return NextResponse.json(dep, { status: 201 });
  });
}