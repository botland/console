'use client';

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { GatewayInfo } from '@/lib/types';

export function WorkerBanner() {
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);

  useEffect(() => {
    api
      .status()
      .then((s) => setGateway(s.gateway))
      .catch(() => setGateway(null));
  }, []);

  if (!gateway || gateway.is_head) return null;

  const local = gateway.local_node_id;
  const headUrl = gateway.head_api_url.replace(/\/api$/, '');

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      This console is running on worker <strong>{local}</strong>. API calls are proxied to the head
      at{' '}
      <a href={headUrl} className="text-cyan-300 underline underline-offset-2">
        {headUrl}
      </a>
      .
    </div>
  );
}