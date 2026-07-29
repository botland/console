import { NextRequest, NextResponse } from 'next/server';

import { SupportServiceError } from '@/lib/support/client';
import { qualifyHfWithCache } from '@/lib/support/qualify-service';

/** POST /api/qualify/hf — qualify a Hub model without downloading weights. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      model_ref?: string;
      revision?: string;
      refresh?: boolean;
    };
    if (!body.model_ref || typeof body.model_ref !== 'string' || !body.model_ref.trim()) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'model_ref is required' },
        { status: 400 },
      );
    }

    const result = await qualifyHfWithCache({
      model_ref: body.model_ref,
      revision: typeof body.revision === 'string' ? body.revision : 'main',
      refresh: Boolean(body.refresh),
    });

    const status = result.cached || result.status === 'complete' ? 200 : 202;
    return NextResponse.json(result, { status });
  } catch (error) {
    if (error instanceof SupportServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to qualify model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
