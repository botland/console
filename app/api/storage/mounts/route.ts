import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { addMount } from '@/lib/mock/store';
import type { StorageMount } from '@/lib/types';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as Omit<StorageMount, 'id'>;
    const mount = addMount({ ...body, id: `mount-${Date.now()}` });
    return NextResponse.json(mount, { status: 201 });
  });
}