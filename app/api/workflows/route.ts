import { NextRequest, NextResponse } from 'next/server';

import { listWorkflows } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const tenant = req.nextUrl.searchParams.get('tenant_id') ?? undefined;
    return NextResponse.json(await listWorkflows(tenant ?? undefined));
  });
}
