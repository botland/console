import { NextResponse } from 'next/server';

import { discardPendingChange } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await ctx.params;
    return NextResponse.json(await discardPendingChange(id));
  });
}
