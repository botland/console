import { NextResponse } from 'next/server';

import { getConfig, getStatus } from '@/lib/mock/store';

export async function GET() {
  return NextResponse.json({
    ...getStatus(),
    config: getConfig(),
  });
}