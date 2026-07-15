import { resolveComputeBackend } from '@/lib/orchestration';
import type { ClusterConfig, GatewayInfo } from '@/lib/types';

export type ConsoleNavId =
  | 'overview'
  | 'deployments'
  | 'orchestration'
  | 'nodes'
  | 'storage'
  | 'packs'
  | 'system'
  | 'support'
  | 'config';

export type ConsoleContext = {
  gateway: GatewayInfo;
  cluster: ClusterConfig;
};

export function buildConsoleContext(
  gateway: GatewayInfo,
  cluster: ClusterConfig,
): ConsoleContext {
  return { gateway, cluster };
}

export function isStandalone(cluster: ClusterConfig): boolean {
  return cluster.serving_mode === 'standalone';
}

export function isDistributedWorker(ctx: ConsoleContext): boolean {
  return !ctx.gateway.is_head && ctx.cluster.serving_mode === 'distributed';
}

export function isDistributedCoordinator(ctx: ConsoleContext): boolean {
  return ctx.gateway.is_head && ctx.cluster.serving_mode === 'distributed';
}

export function visibleNavItems(ctx: ConsoleContext): ConsoleNavId[] {
  const backend = resolveComputeBackend(ctx.cluster);
  const items: ConsoleNavId[] = ['overview', 'orchestration', 'nodes', 'storage', 'system', 'support'];

  if (isStandalone(ctx.cluster) || isDistributedCoordinator(ctx)) {
    items.splice(1, 0, 'deployments');
    // Packs (MCP capability enablement) only on head / standalone
    const storageIdx = items.indexOf('storage');
    items.splice(storageIdx + 1, 0, 'packs');
    items.push('config');
  } else if (backend === 'federation') {
    items.splice(1, 0, 'deployments');
  }

  return items;
}

export function canManageClusterDeployments(ctx: ConsoleContext): boolean {
  return isStandalone(ctx.cluster) || isDistributedCoordinator(ctx);
}

export function canManageClusterConfig(ctx: ConsoleContext): boolean {
  return isStandalone(ctx.cluster) || isDistributedCoordinator(ctx);
}

export function canManageClusterMounts(ctx: ConsoleContext): boolean {
  return isStandalone(ctx.cluster) || isDistributedCoordinator(ctx);
}

export function canEditOrchestrationTopology(ctx: ConsoleContext): boolean {
  return isStandalone(ctx.cluster) || isDistributedCoordinator(ctx);
}

export function canDetachFromCluster(ctx: ConsoleContext): boolean {
  return isDistributedWorker(ctx);
}

export function canJoinCluster(ctx: ConsoleContext): boolean {
  return isStandalone(ctx.cluster) && ctx.gateway.is_head;
}

export function canMigrateHead(ctx: ConsoleContext): boolean {
  return isDistributedCoordinator(ctx);
}

export function canEditNodePlacement(ctx: ConsoleContext): boolean {
  return isDistributedCoordinator(ctx);
}

export function roleLabel(ctx: ConsoleContext): string {
  if (isStandalone(ctx.cluster)) return 'standalone';
  return ctx.gateway.is_head ? 'coordinator' : 'worker';
}

export function modeLabel(ctx: ConsoleContext): string {
  return ctx.cluster.serving_mode === 'distributed' ? 'distributed' : 'standalone';
}

export const NAV_ROUTES: Record<ConsoleNavId, string> = {
  overview: '/',
  deployments: '/deployments',
  orchestration: '/orchestration',
  nodes: '/nodes',
  storage: '/storage',
  packs: '/packs',
  system: '/system',
  support: '/support',
  config: '/config',
};