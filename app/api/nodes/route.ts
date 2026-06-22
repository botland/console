import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/mock/store';

export async function GET() {
  return NextResponse.json(getConfig().nodes);
}