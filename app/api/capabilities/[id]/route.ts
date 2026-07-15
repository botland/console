import { NextRequest, NextResponse } from 'next/server';

import { setCapabilityEnabled } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await params;
    const body = (await req.json()) as { enabled?: boolean };
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled is required' }, { status: 400 });
    }
    const item = await setCapabilityEnabled(id, body.enabled);
    return NextResponse.json(item);
  });
}
