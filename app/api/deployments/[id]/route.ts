import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { deleteDeployment, getDeployment, updateDeployment } from '@/lib/mock/store';
import type { DeploymentConfig } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const dep = getDeployment(id);
    if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(dep);
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const body = (await req.json()) as DeploymentConfig;
    const dep = updateDeployment(id, { ...body, id });
    if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(dep);
  });
}

export async function DELETE(req: Request, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const deleted = deleteDeployment(id);
    return NextResponse.json({ deleted });
  });
}