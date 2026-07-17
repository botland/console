import { NextRequest, NextResponse } from 'next/server';

import { listAccessAudit } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    const sp = req.nextUrl.searchParams;
    const limitRaw = sp.get('limit');
    const subject = sp.get('subject') ?? undefined;
    const allowedRaw = sp.get('allowed');
    let allowed: boolean | undefined;
    if (allowedRaw != null) {
      allowed = allowedRaw.toLowerCase() === 'true' || allowedRaw === '1';
    }
    let limit: number | undefined;
    if (limitRaw) {
      const n = Number(limitRaw);
      if (!Number.isNaN(n)) limit = n;
    }
    return NextResponse.json(await listAccessAudit({ limit, subject, allowed }));
  });
}
