import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/runtime';
import { listTickets, SupportServiceError } from '@/lib/support/client';

export async function GET() {
  try {
    const config = await getConfig();
    const result = await listTickets(config.appliance_id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SupportServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to list support tickets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}