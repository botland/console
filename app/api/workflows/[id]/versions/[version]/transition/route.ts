import { NextRequest, NextResponse } from 'next/server';

import { transitionWorkflow } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  return runWithHeadAuthority(req, async () => {
    const { id, version } = await params;
    const body = (await req.json()) as { status?: string; note?: string };
    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }
    return NextResponse.json(
      await transitionWorkflow(id, version, body.status, body.note ?? ''),
    );
  });
}
