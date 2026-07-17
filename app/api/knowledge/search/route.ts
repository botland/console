import { NextResponse } from 'next/server';

import { knowledgeSearch } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: Request) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(await knowledgeSearch(body));
  });
}
