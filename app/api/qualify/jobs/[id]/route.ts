import { NextRequest, NextResponse } from 'next/server';

import { SupportServiceError } from '@/lib/support/client';
import { fetchQualifyJobAndStore } from '@/lib/support/qualify-service';

/** GET /api/qualify/jobs/:id — poll a qualification job; stores completes. */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'job id is required' },
        { status: 400 },
      );
    }
    const job = await fetchQualifyJobAndStore(id);
    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof SupportServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to load qualification job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
