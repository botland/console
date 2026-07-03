import { NextRequest, NextResponse } from 'next/server';

import { addMount } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';
import type { StorageMount } from '@/lib/types';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as Omit<StorageMount, 'id'>;
    const mount = await addMount({ ...body, id: `mount-${Date.now()}` });
    return NextResponse.json(mount, { status: 201 });
  });
}