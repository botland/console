import { NextRequest, NextResponse } from 'next/server';

import { putPlatformTenant } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const body = (await req.json()) as { tenant_id?: string };
    if (!body.tenant_id?.trim()) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }
    return NextResponse.json(await putPlatformTenant(body.tenant_id.trim()));
  });
}
