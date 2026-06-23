import { NextRequest, NextResponse } from 'next/server';

import { deriveRecommendation } from '@/lib/planner';
import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig } from '@/lib/mock/store';
import type { DeploymentConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const dep = (await req.json()) as DeploymentConfig;
    const config = getConfig();
    return NextResponse.json(deriveRecommendation(dep, config));
  });
}