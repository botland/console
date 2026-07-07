import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/runtime';
import { getEntitlement } from '@/lib/support/client';

export async function GET() {
  try {
    const config = await getConfig();
    const entitlement = await getEntitlement(config.appliance_id);
    return NextResponse.json(entitlement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check support entitlement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}