import { NextResponse } from 'next/server';

import { runWithHeadAuthority } from '@/lib/mock/gateway';
import { listNodesWithAgents } from '@/lib/mock/store';

export async function GET(req: Request) {
  return runWithHeadAuthority(req, async () => NextResponse.json(listNodesWithAgents()));
}