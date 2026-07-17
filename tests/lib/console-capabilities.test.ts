import { describe, expect, it } from 'vitest';

import {
  buildConsoleContext,
  canDetachFromCluster,
  canJoinCluster,
  canManageClusterConfig,
  visibleNavItems,
} from '@/lib/console-capabilities';
import type { ClusterConfig, GatewayInfo } from '@/lib/types';

function ctx(gateway: GatewayInfo, cluster: Partial<ClusterConfig>) {
  const full: ClusterConfig = {
    serving_mode: 'standalone',
    head_node_id: 'node-1',
    head_epoch: 1,
    global_defaults: { autoscale_enabled: true },
    ...cluster,
  };
  return buildConsoleContext(gateway, full);
}

describe('console-capabilities', () => {
  it('shows config for standalone coordinator', () => {
    const items = visibleNavItems(
      ctx({ local_node_id: 'node-1', is_head: true, head_api_url: 'http://10.0.0.1/api' }, {}),
    );
    expect(items).toContain('config');
    expect(items).toContain('deployments');
    expect(items).toContain('access');
    expect(items).toContain('packs');
  });

  it('hides access audit on distributed worker', () => {
    const items = visibleNavItems(
      ctx(
        { local_node_id: 'node-2', is_head: false, head_api_url: 'http://10.0.0.1/api' },
        { serving_mode: 'distributed', compute_backend: 'federation' },
      ),
    );
    expect(items).not.toContain('access');
    expect(items).not.toContain('packs');
  });

  it('hides config for distributed worker', () => {
    const items = visibleNavItems(
      ctx(
        { local_node_id: 'node-2', is_head: false, head_api_url: 'http://10.0.0.1/api' },
        { serving_mode: 'distributed', compute_backend: 'federation' },
      ),
    );
    expect(items).not.toContain('config');
    expect(items).toContain('deployments');
  });

  it('hides deployments for ray worker', () => {
    const items = visibleNavItems(
      ctx(
        { local_node_id: 'node-2', is_head: false, head_api_url: 'http://10.0.0.1/api' },
        { serving_mode: 'distributed', compute_backend: 'cluster' },
      ),
    );
    expect(items).not.toContain('deployments');
  });

  it('flags detach only for distributed workers', () => {
    expect(
      canDetachFromCluster(
        ctx(
          { local_node_id: 'node-2', is_head: false, head_api_url: 'http://10.0.0.1/api' },
          { serving_mode: 'distributed' },
        ),
      ),
    ).toBe(true);
    expect(
      canDetachFromCluster(
        ctx(
          { local_node_id: 'node-1', is_head: true, head_api_url: 'http://10.0.0.1/api' },
          { serving_mode: 'distributed' },
        ),
      ),
    ).toBe(false);
  });

  it('allows join on standalone coordinator', () => {
    expect(
      canJoinCluster(
        ctx({ local_node_id: 'node-1', is_head: true, head_api_url: 'http://10.0.0.1/api' }, {}),
      ),
    ).toBe(true);
    expect(canManageClusterConfig(ctx({ local_node_id: 'node-2', is_head: false, head_api_url: 'http://10.0.0.1/api' }, { serving_mode: 'distributed' }))).toBe(false);
  });
});