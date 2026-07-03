import { NextRequest, NextResponse } from 'next/server';

import { importConfig } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function POST(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    try {
      const body = await req.json();
      const result = await importConfig(body);
      if (!result.applied) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { applied: false, error: e instanceof Error ? e.message : 'Invalid JSON' },
        { status: 400 },
      );
    }
  });
}