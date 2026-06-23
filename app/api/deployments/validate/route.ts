import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/mock/store';
import { validateDeployment } from '@/lib/validation/feasibility';
import type { DeploymentConfig } from '@/lib/types';

export async function POST(req: NextRequest) {
  const dep = (await req.json()) as DeploymentConfig;
  const config = getConfig();
  return NextResponse.json(validateDeployment(dep, config));
}