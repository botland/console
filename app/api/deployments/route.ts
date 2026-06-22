import { NextRequest, NextResponse } from 'next/server';

import { createDeployment, listDeployments } from '@/lib/mock/store';
import type { DeploymentConfig } from '@/lib/types';

export async function GET() {
  return NextResponse.json(listDeployments());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as DeploymentConfig;
  const dep = createDeployment(body);
  return NextResponse.json(dep, { status: 201 });
}