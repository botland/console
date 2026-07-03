import { NextRequest, NextResponse } from 'next/server';

import { deriveRecommendation } from '@/lib/planner';
import { getConfig } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { DeploymentConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const dep = (await req.json()) as DeploymentConfig;
    const config = await getConfig();
    return NextResponse.json(deriveRecommendation(dep, config));
  });
}