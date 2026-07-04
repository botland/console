import { getConfig, getLocalNodeId, isHeadCoordinator } from './index';

export const COORDINATOR_HEADER = 'x-appliance-coordinator';
export const LOCAL_NODE_HEADER = 'x-appliance-local-node';

export async function getHeadApiBase(): Promise<string> {
  if (process.env.APPLIANCE_HEAD_INTERNAL_URL) {
    return process.env.APPLIANCE_HEAD_INTERNAL_URL.replace(/\/$/, '');
  }
  const config = await getConfig();
  const port = process.env.APPLIANCE_PORT ?? '3000';
  return `http://${config.system.network.head_ip}:${port}`;
}

export async function getGatewayInfo() {
  const base = await getHeadApiBase();
  return {
    local_node_id: await getLocalNodeId(),
    is_head: await isHeadCoordinator(),
    head_api_url: `${base}/api`,
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
  const headBase = await getHeadApiBase();
  const target = `${headBase}${incoming.pathname}${incoming.search}`;
  const headers = new Headers(req.headers);
  headers.set(COORDINATOR_HEADER, 'true');
  headers.set(LOCAL_NODE_HEADER, await getLocalNodeId());

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
  if ((await isHeadCoordinator()) || isCoordinatorRequest(req)) {
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