import { NextRequest, NextResponse } from 'next/server';

import { setConfig, startReconcile } from '@/lib/mock/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    setConfig(body);
    startReconcile('Configuration imported — applying changes');
    return NextResponse.json({ applied: true });
  } catch (e) {
    return NextResponse.json(
      { applied: false, error: e instanceof Error ? e.message : 'Invalid JSON' },
      { status: 400 },
    );
  }
}