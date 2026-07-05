import { NextRequest, NextResponse } from 'next/server';

import { getConfig, getOrchestration } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import { validateDeployment } from '@/lib/validation/feasibility';
import type { DeploymentConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const dep = (await req.json()) as DeploymentConfig;
    const [config, orchestration] = await Promise.all([getConfig(), getOrchestration()]);
    return NextResponse.json(validateDeployment(dep, config, orchestration));
  });
}