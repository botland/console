import { NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { removeMount } from '@/lib/mock/store';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const deleted = removeMount(id);
    return NextResponse.json({ deleted });
  });
}