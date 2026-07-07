import { describe, expect, it } from 'vitest';

import {
  deploymentUsesManualPlacement,
  resolveDeploymentFormMode,
  resolvePlacementMode,
} from '@/lib/deployment-ui';
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
  it('shows placement picker when deployment uses manual placement', () => {
    const mode = resolveDeploymentFormMode(cluster({}), {
      placement: { mode: 'manual', targets: [{ node_id: 'node-1', gpu_indices: [0] }] },
    });
    expect(mode.canChoosePlacement).toBe(true);
    expect(mode.showPlacement).toBe(true);
    expect(mode.placementRequired).toBe(true);
    expect(mode.showNodesPerInstance).toBe(false);
  });

  it('hides placement picker when deployment uses auto placement', () => {
    const mode = resolveDeploymentFormMode(cluster({}), {
      placement: { mode: 'auto' },
    });
    expect(mode.canChoosePlacement).toBe(true);
    expect(mode.showPlacement).toBe(false);
    expect(mode.placementRequired).toBe(false);
    expect(mode.showNodesPerInstance).toBe(false);
  });

  it('shows nodes per instance only for distributed cluster backend', () => {
    const mode = resolveDeploymentFormMode(
      cluster({ compute_backend: 'cluster', federation_layout: undefined }),
    );
    expect(mode.showNodesPerInstance).toBe(true);
    expect(mode.canChoosePlacement).toBe(false);
    expect(mode.showPlacement).toBe(false);
  });
});

describe('resolvePlacementMode', () => {
  it('prefers explicit deployment mode over legacy cluster flag', () => {
    expect(
      resolvePlacementMode({ mode: 'auto' }, cluster({ federation_auto_placement: false })),
    ).toBe('auto');
    expect(
      resolvePlacementMode({ mode: 'manual' }, cluster({ federation_auto_placement: true })),
    ).toBe('manual');
  });

  it('falls back to legacy cluster flag when mode is unset', () => {
    expect(resolvePlacementMode(undefined, cluster({ federation_auto_placement: false }))).toBe(
      'manual',
    );
    expect(deploymentUsesManualPlacement(undefined, cluster({ federation_auto_placement: true }))).toBe(
      false,
    );
  });
});