import { NextRequest, NextResponse } from 'next/server';

import { reindexCorpus } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    let body: { tenant_id?: string; corpus_id?: string; path_prefix?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    return NextResponse.json(await reindexCorpus(body));
  });
}
