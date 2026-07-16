import { NextResponse } from 'next/server';

import { applyPendingChange } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await ctx.params;
    const body = (await req.json()) as { preview_checksum?: string; ack?: string };
    return NextResponse.json(
      await applyPendingChange(id, {
        preview_checksum: body.preview_checksum ?? '',
        ack: body.ack ?? 'Apply',
      }),
    );
  });
}
