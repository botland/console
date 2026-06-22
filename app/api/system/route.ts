import { NextRequest, NextResponse } from 'next/server';

import { getConfig, updateSystem } from '@/lib/mock/store';
import type { SystemConfig } from '@/lib/types';

export async function GET() {
  return NextResponse.json(getConfig().system);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as SystemConfig;
  const config = updateSystem(body);
  return NextResponse.json(config.system);
}