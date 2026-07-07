import { describe, expect, it } from 'vitest';

import { sampleDeployment } from '@/tests/helpers/fixtures';
import { minimalConfig } from '@/tests/helpers/fixtures';

import { buildInventory } from '@/lib/validation/inventory';
import { effectiveInstances, gpusPerReplica, peakGpuDemand } from '@/lib/parallelism';

describe('parallelism helpers', () => {
  it('computes gpus per replica from TP and PP', () => {
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 4,
        nodes_per_instance: 2,
        autoscaling: null,
      },
    });
    expect(gpusPerReplica(dep)).toBe(8);
  });

  it('auto scale fills GPU slots', () => {
    const inventory = buildInventory(minimalConfig());
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'auto' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 2,
        nodes_per_instance: 1,
        autoscaling: null,
      },
    });
    expect(effectiveInstances(dep, inventory)).toBe(Math.floor(inventory.available_gpu_count / 2));
  });

  it('peak demand uses autoscale max', () => {
    const inventory = buildInventory(minimalConfig());
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 2,
        nodes_per_instance: 2,
        autoscaling: { min_instances: 1, max_instances: 3, target_ongoing_requests: 8 },
      },
    });
    expect(peakGpuDemand(dep, inventory)).toBe(3 * 4);
  });
});