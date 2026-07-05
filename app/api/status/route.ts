import { NextResponse } from 'next/server';

import { getConfig, getGatewayStatus, getStatus } from '@/lib/runtime';

/** Always served from the local controller — gateway reflects this appliance, not the coordinator. */
export async function GET() {
  const status = await getStatus();

  let config = null;
  let config_error: string | undefined;
  try {
    config = await getConfig();
  } catch (e) {
    config_error = e instanceof Error ? e.message : 'Config unavailable';
  }

  const gateway = await getGatewayStatus().catch(() => null);

  return NextResponse.json({ ...status, config, config_error, gateway });
}