import { NextRequest, NextResponse } from 'next/server';

import { updateNode } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { NodeConfig } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const body = (await req.json()) as Partial<NodeConfig>;
    const node = await updateNode(id, body);
    if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(node);
  });
}