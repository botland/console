import { describe, expect, it } from 'vitest';

import { resolveDeploymentFormMode } from '@/lib/deployment-ui';
import type { OrchestrationConfig } from '@/lib/types';

function cluster(overrides: Partial<OrchestrationConfig>): OrchestrationConfig {
  return {
    serving_mode: 'distributed',
    compute_backend: 'federation',
    federation_layout: 'diverse',
    head_node_id: 'node-1',
    head_epoch: 1,
    global_defaults: { autoscale_enabled: false },
    ...overrides,
  };
}

describe('resolveDeploymentFormMode', () => {
  it('shows placement when federation manual placement is enabled', () => {
    const mode = resolveDeploymentFormMode(
      cluster({ federation_auto_placement: false }),
    );
    expect(mode.showPlacement).toBe(true);
    expect(mode.placementRequired).toBe(true);
    expect(mode.showNodesPerInstance).toBe(false);
  });

  it('hides placement and nodes per instance in federated diverse auto mode', () => {
    const mode = resolveDeploymentFormMode(
      cluster({ federation_auto_placement: true }),
    );
    expect(mode.showPlacement).toBe(false);
    expect(mode.showNodesPerInstance).toBe(false);
  });

  it('shows nodes per instance only for distributed cluster backend', () => {
    const mode = resolveDeploymentFormMode(
      cluster({ compute_backend: 'cluster', federation_layout: undefined }),
    );
    expect(mode.showNodesPerInstance).toBe(true);
    expect(mode.showPlacement).toBe(false);
  });
});