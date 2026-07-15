import { NextRequest, NextResponse } from 'next/server';

import { generateWorkflow } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = await req.json();
    return NextResponse.json(await generateWorkflow(body));
  });
}
