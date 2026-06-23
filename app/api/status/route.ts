import { NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { getConfig, getGatewayStatus, getStatus } from '@/lib/mock/store';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () =>
    NextResponse.json({
      ...getStatus(),
      config: getConfig(),
      gateway: getGatewayStatus(),
    }),
  );
}