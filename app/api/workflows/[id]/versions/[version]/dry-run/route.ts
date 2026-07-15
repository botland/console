import { NextResponse } from 'next/server';

import { dryRunWorkflow } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  return runWithHeadAuthority(req, async () => {
    const { id, version } = await params;
    return NextResponse.json(await dryRunWorkflow(id, version));
  });
}
