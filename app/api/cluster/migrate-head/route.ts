import { NextRequest, NextResponse } from 'next/server';

import { migrateHead } from '@/lib/mock/store';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { head_node_id: string };
  if (!body.head_node_id) {
    return NextResponse.json({ error: 'head_node_id required' }, { status: 400 });
  }
  const result = migrateHead(body.head_node_id);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}