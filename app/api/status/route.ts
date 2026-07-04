import { NextResponse } from 'next/server';

import { getConfig, getGatewayStatus, getStatus } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => {
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
  });
}