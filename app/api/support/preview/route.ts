import { NextRequest, NextResponse } from 'next/server';

import { buildDiagnosticBundle } from '@/lib/support/bundle';

export async function GET(req: NextRequest) {
  try {
    const userNote = req.nextUrl.searchParams.get('note') ?? '';
    const bundle = await buildDiagnosticBundle(userNote);
    return NextResponse.json(bundle);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build diagnostic bundle';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}