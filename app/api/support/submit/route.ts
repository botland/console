import { NextRequest, NextResponse } from 'next/server';

import { buildDiagnosticBundle } from '@/lib/support/bundle';
import { submitBundle, SupportServiceError } from '@/lib/support/client';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { user_note?: string };
    const bundle = await buildDiagnosticBundle(body.user_note ?? '');
    const result = await submitBundle(bundle);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof SupportServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to submit support report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}