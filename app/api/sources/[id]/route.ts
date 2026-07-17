import { NextResponse } from 'next/server';

import { deleteSource, patchSource } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(await patchSource(id, body));
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return runWithHeadAuthority(req, async () => {
    const { id } = await ctx.params;
    return NextResponse.json(await deleteSource(id));
  });
}
