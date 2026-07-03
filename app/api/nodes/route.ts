import { NextResponse } from 'next/server';

import { listNodesWithAgents } from '@/lib/runtime';
import { runWithHeadAuthority } from '@/lib/runtime/gateway';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(await listNodesWithAgents()));
}