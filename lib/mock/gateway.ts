import { getConfig, getLocalNodeId, isHeadCoordinator } from './store';

export const COORDINATOR_HEADER = 'x-appliance-coordinator';

export function getHeadApiBase(): string {
  if (process.env.APPLIANCE_HEAD_INTERNAL_URL) {
    return process.env.APPLIANCE_HEAD_INTERNAL_URL.replace(/\/$/, '');
  }
  const config = getConfig();
  const port = process.env.APPLIANCE_PORT ?? '3000';
  return `http://${config.system.network.head_ip}:${port}`;
}

export function getGatewayInfo() {
  return {
    local_node_id: getLocalNodeId(),
    is_head: isHeadCoordinator(),
    head_api_url: `${getHeadApiBase()}/api`,
  };
}

export function isCoordinatorRequest(req: Request): boolean {
  return req.headers.get(COORDINATOR_HEADER) === 'true';
}

function useInternalProxy(): boolean {
  return process.env.APPLIANCE_GATEWAY_INTERNAL === '1';
}

export async function proxyToHead(req: Request): Promise<Response> {
  if (useInternalProxy()) {
    throw new Error('INTERNAL_PROXY_DELEGATE');
  }

  const incoming = new URL(req.url);
  const target = `${getHeadApiBase()}${incoming.pathname}${incoming.search}`;
  const headers = new Headers(req.headers);
  headers.set(COORDINATOR_HEADER, 'true');

  const init: RequestInit = {
    method: req.method,
    headers,
    duplex: 'half',
  } as RequestInit;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
  }

  return fetch(target, init);
}

export async function runWithHeadAuthority(
  req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (isHeadCoordinator() || isCoordinatorRequest(req)) {
    return handler();
  }

  try {
    return await proxyToHead(req);
  } catch (error) {
    if (error instanceof Error && error.message === 'INTERNAL_PROXY_DELEGATE') {
      return handler();
    }
    throw error;
  }
}