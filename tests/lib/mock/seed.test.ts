import { afterEach, describe, expect, it } from 'vitest';

import { createSeedState, seedConfig } from '@/lib/mock/seed';

describe('seed', () => {
  const originalHeadId = seedConfig.cluster.head_node_id;

  afterEach(() => {
    seedConfig.cluster.head_node_id = originalHeadId;
  });

  it('creates a demo cluster state', () => {
    const state = createSeedState();
    expect(state.config.nodes).toHaveLength(3);
    expect(state.status.state).toBe('READY');
    expect(state.storage_usage.total_bytes).toBeGreaterThan(0);
  });

  it('falls back to network head ip when head node id is stale', () => {
    seedConfig.cluster.head_node_id = 'missing-head';
    const state = createSeedState();
    expect(state.status.head.head_ip).toBe(seedConfig.system.network.head_ip);
  });
});