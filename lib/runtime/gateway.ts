import { getConsoleApiPath, toManagementApiBase } from '@/lib/console-api-path';
import { getLocalNodeId, isHeadCoordinator } from './index';

export const COORDINATOR_HEADER = 'x-appliance-coordinator';
export const LOCAL_NODE_HEADER = 'x-appliance-local-node';

/**
 * Base URL for the coordinator management API (includes `/console/api`).
 * HEAD_CONSOLE_URL may be a full API URL or a host origin.
 */
export async function getHeadApiBase(): Promise<string> {
  if (process.env.APPLIANCE_HEAD_INTERNAL_URL) {
    return process.env.APPLIANCE_HEAD_INTERNAL_URL.replace(/\/$/, '');
  }
  const headConsole = process.env.HEAD_CONSOLE_URL?.trim();
  if (headConsole) {
    return toManagementApiBase(headConsole);
  }
  const { getConfig } = await import('./index');
  const config = await getConfig();
  const port = process.env.APPLIANCE_CONSOLE_PORT ?? process.env.APPLIANCE_PORT ?? '80';
  const path = getConsoleApiPath();
  if (port === '80' || port === '443') {
    return `http://${config.system.network.head_ip}${path}`;
  }
  return `http://${config.system.network.head_ip}:${port}${path}`;
}

export async function getGatewayInfo() {
  const apiBase = await getHeadApiBase();
  // getHeadApiBase already returns the full management API base (…/console/api).
  // APPLIANCE_HEAD_INTERNAL_URL may be an origin only — normalize.
  const head_api_url = process.env.APPLIANCE_HEAD_INTERNAL_URL
    ? toManagementApiBase(apiBase)
    : apiBase.endsWith('/api')
      ? apiBase
      : toManagementApiBase(apiBase);
  return {
    local_node_id: await getLocalNodeId(),
    is_head: await isHeadCoordinator(),
    head_api_url,
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
