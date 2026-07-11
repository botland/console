import { describe, expect, it } from 'vitest';

import { seedConfig } from '@/lib/mock/seed';
import { getConfig, resetTestState } from '@/lib/mock/store';

describe('seed and store parity (REFACTO §1.2)', () => {
  it('resetTestState seeds cluster head from seed config', () => {
    resetTestState({ seed: true, persist: false });
    const config = getConfig();
    expect(config.cluster.head_node_id).toBe(seedConfig.cluster.head_node_id);
    expect(config.cluster.serving_mode).toBe(seedConfig.cluster.serving_mode);
    expect(config.nodes.length).toBe(seedConfig.nodes.length);
  });

  it('seed head node ip matches system network head_ip', () => {
    const head = seedConfig.nodes.find((n) => n.is_head);
    expect(head?.ip).toBe(seedConfig.system.network.head_ip);
  });
});