import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/mock/store';
import { toSortedJson } from '@/lib/sort-json';

export async function GET() {
  const config = getConfig();
  const body = toSortedJson(config);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="conf.json"',
    },
  });
}