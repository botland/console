import { NextRequest, NextResponse } from 'next/server';

import { SupportServiceError } from '@/lib/support/client';
import { qualifyMetadataWithCache } from '@/lib/support/qualify-service';
import type { ModelMetadataBundle } from '@/lib/support/qualify-types';

/** POST /api/qualify/metadata — qualify from appliance-collected metadata files. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ModelMetadataBundle | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'JSON body required' },
        { status: 400 },
      );
    }
    if (body.bundle_version !== '1') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'bundle_version must be "1"' },
        { status: 400 },
      );
    }
    if (!body.model_ref || typeof body.model_ref !== 'string') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'model_ref is required' },
        { status: 400 },
      );
    }
    if (!body.files || typeof body.files !== 'object' || !body.files['config.json']) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'files.config.json is required' },
        { status: 400 },
      );
    }

    const result = await qualifyMetadataWithCache(body);
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
