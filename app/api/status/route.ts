import { NextResponse } from 'next/server';

import { getConfig, getGatewayStatus, getStatus } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () =>
    NextResponse.json({
      ...(await getStatus()),
      config: await getConfig(),
      gateway: await getGatewayStatus(),
    }),
  );
}