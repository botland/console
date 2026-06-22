import { NextResponse } from 'next/server';

import { removeMount } from '@/lib/mock/store';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const deleted = removeMount(id);
  return NextResponse.json({ deleted });
}