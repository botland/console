import { NextRequest, NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig, setConfig } from '@/lib/mock/store';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(getConfig()));
}

export async function PUT(req: NextRequest) {
  return runWithHeadAuthority(req, async () => {
    try {
      const body = await req.json();
      const config = setConfig(body);
      return NextResponse.json(config);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Invalid config' },
        { status: 400 },
      );
    }
  });
}