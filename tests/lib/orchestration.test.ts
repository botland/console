import { describe, expect, it } from 'vitest';

import {
  defaultComputeBackend,
  normalizeClusterConfig,
  normalizeClusterPatch,
  resolveComputeBackend,
  toOrchestrationPutPayload,
} from '@/lib/orchestration';
import type { ClusterConfig } from '@/lib/types';

const baseCluster = (): ClusterConfig => ({
  serving_mode: 'distributed',
  compute_backend: 'cluster',
  head_node_id: 'node-1',
  head_epoch: 1,
  global_defaults: { autoscale_enabled: true },
});

describe('orchestration', () => {
  it('defaults compute backend from serving mode', () => {
    expect(defaultComputeBackend('standalone')).toBe('federation');
    expect(defaultComputeBackend('distributed')).toBe('cluster');
  });

  it('normalizes standalone switch away from cluster backend', () => {
    const normalized = normalizeClusterPatch(baseCluster(), { serving_mode: 'standalone' });
    expect(normalized.serving_mode).toBe('standalone');
    expect(normalized.compute_backend).toBe('federation');
    expect(resolveComputeBackend(normalized)).toBe('federation');
  });

  it('clears federation_layout when cluster backend is active', () => {
    const normalized = normalizeClusterConfig({
      ...baseCluster(),
      federation_layout: 'replicated',
    });
    expect(normalized.federation_layout).toBeUndefined();
    expect('federation_layout' in normalized).toBe(false);
  });

  it('strips read-only orchestration fields before PUT', () => {
    const payload = toOrchestrationPutPayload({
      ...baseCluster(),
      federation_layout: 'diverse',
      federation_auto_placement: false,
    });
    expect(payload.compute_backend).toBe('cluster');
    expect('federation_layout' in payload).toBe(false);
    expect('federation_auto_placement' in payload).toBe(false);
  });

  it('normalizeClusterPatch drops federation_auto_placement from merged state', () => {
    const payload = normalizeClusterPatch(
      {
        ...baseCluster(),
        compute_backend: 'federation',
        federation_layout: 'diverse',
        federation_auto_placement: false,
      },
      { compute_backend: 'cluster' },
    );
    expect(payload.compute_backend).toBe('cluster');
    expect('federation_layout' in payload).toBe(false);
    expect('federation_auto_placement' in payload).toBe(false);
  });

  it('restores head_gpu on standalone when it was disabled for distributed', () => {
    const normalized = normalizeClusterConfig({
      ...baseCluster(),
      serving_mode: 'standalone',
      compute_backend: 'federation',
      head_gpu: false,
    });
    expect(normalized.head_gpu).toBe(true);
  });
});