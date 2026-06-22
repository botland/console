import { NextRequest, NextResponse } from 'next/server';

import { updateNode } from '@/lib/mock/store';
import type { NodeConfig } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as Partial<NodeConfig>;
  const node = updateNode(id, body);
  if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(node);
}