import { NextResponse } from 'next/server';

import { isQualifyEnabled } from '@/lib/support/qualify-client';
import { listStoredQualifications } from '@/lib/support/qualify-store';

/** GET /api/qualify — list qualifications stored on this appliance. */
export async function GET() {
  if (!isQualifyEnabled()) {
    return NextResponse.json(
      { error: 'disabled', message: 'Model qualification is not enabled' },
      { status: 503 },
    );
  }
  return NextResponse.json({ qualifications: listStoredQualifications() });
}
