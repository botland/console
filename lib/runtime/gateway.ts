import { getLocalNodeId, isHeadCoordinator } from './index';

export const COORDINATOR_HEADER = 'x-appliance-coordinator';
export const LOCAL_NODE_HEADER = 'x-appliance-local-node';

function headConsoleOrigin(): string | null {
  const headConsole = process.env.HEAD_CONSOLE_URL?.trim();
  if (!headConsole) {
    return null;
  }
  try {
    const parsed = new URL(headConsole);
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin;
  } catch {
    return null;
  }
}

export async function getHeadApiBase(): Promise<string> {
  if (process.env.APPLIANCE_HEAD_INTERNAL_URL) {
    return process.env.APPLIANCE_HEAD_INTERNAL_URL.replace(/\/$/, '');
  }
  const fromHeadConsole = headConsoleOrigin();
  if (fromHeadConsole) {
    return fromHeadConsole;
  }
  const { getConfig } = await import('./index');
  const config = await getConfig();
  const port = process.env.APPLIANCE_CONSOLE_PORT ?? '80';
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

/** Console always talks to the local controller — no head console proxy. */
export async function runWithHeadAuthority(
  _req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  return handler();
}