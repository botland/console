import { NextResponse } from 'next/server';

import { removeMount } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const deleted = await removeMount(id);
    return NextResponse.json({ deleted });
  });
}