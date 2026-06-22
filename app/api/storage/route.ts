import { NextResponse } from 'next/server';

import { getConfig, getStorage } from '@/lib/mock/store';

export async function GET() {
  const usage = getStorage();
  const mounts = getConfig().storage.mounts;
  return NextResponse.json({ ...usage, mounts });
}