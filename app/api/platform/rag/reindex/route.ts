import { NextRequest, NextResponse } from 'next/server';

import { reindexCorpus } from '@/lib/runtime';
import { ControllerError } from '@/lib/runtime/client';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    let body: { tenant_id?: string; corpus_id?: string; path_prefix?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    try {
      return NextResponse.json(await reindexCorpus(body));
    } catch (err) {
      if (err instanceof ControllerError) {
        let parsed: unknown = { detail: err.body || err.message };
        try {
          parsed = JSON.parse(err.body);
        } catch {
          /* keep string detail */
        }
        return NextResponse.json(
          typeof parsed === 'object' && parsed !== null
            ? parsed
            : { detail: err.body || err.message },
          { status: err.status || 502 },
        );
      }
      throw err;
    }
  });
}
