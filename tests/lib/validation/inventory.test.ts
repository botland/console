import { describe, expect, it } from 'vitest';

import { minimalConfig } from '@/tests/helpers/fixtures';

import { buildInventory } from '@/lib/validation/inventory';

describe('buildInventory', () => {
  it('counts online GPUs and reserved capacity', () => {
    const config = minimalConfig();
    const inv = buildInventory(config);
    expect(inv.online_node_count).toBe(3);
    expect(inv.total_gpu_count).toBe(6);
    expect(inv.available_gpu_count).toBe(5);
    expect(inv.max_gpus_per_node).toBe(2);
    expect(inv.head_online).toBe(true);
  });

  it('marks head offline when head node is down', () => {
    const config = minimalConfig({
      nodes: minimalConfig().nodes.map((n) =>
        n.id === 'node-1' ? { ...n, status: 'offline' as const } : n,
      ),
    });
    const inv = buildInventory(config);
    expect(inv.head_online).toBe(false);
    expect(inv.online_node_count).toBe(2);
  });

  it('never reports zero max GPUs per node', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'offline',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 2,
          labels: [],
          status: 'offline',
          gpus: [
            { index: 0, name: 'GPU', vram_mb: 8192 },
            { index: 1, name: 'GPU', vram_mb: 8192 },
          ],
        },
      ],
    });
    const inv = buildInventory(config);
    expect(inv.available_gpu_count).toBe(0);
    expect(inv.max_gpus_per_node).toBe(1);
  });
});