import { describe, expect, it } from 'vitest';

import { minimalConfig, sampleDeployment } from '@/tests/helpers/fixtures';

import { deriveRecommendation } from '@/lib/planner';

describe('deriveRecommendation', () => {
  it('recommends balanced defaults for distributed mode', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.instances).toBeGreaterThanOrEqual(1);
    expect(rec.gpus_per_instance).toBeGreaterThanOrEqual(1);
    expect(rec.nodes_per_instance).toBe(1);
    expect(rec.context_length).toBe(8192);
  });

  it('optimizes for max throughput', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'max_throughput', scale: 'small' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.instances).toBeGreaterThanOrEqual(2);
    expect(rec.gpus_per_instance).toBeLessThanOrEqual(2);
  });

  it('optimizes for low latency', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'low_latency', scale: 'large' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.instances).toBe(1);
    expect(rec.context_length).toBe(4096);
  });

  it('optimizes for high availability', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'high_availability', scale: 'medium' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.instances).toBeGreaterThanOrEqual(2);
  });

  it('keeps standalone deployments on a single node', () => {
    const config = minimalConfig({
      cluster: {
        serving_mode: 'standalone',
        head_node_id: 'node-1',
        head_epoch: 1,
        global_defaults: { autoscale_enabled: false },
      },
    });
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'large' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.nodes_per_instance).toBe(1);
  });

  it('may span nodes for large distributed deployments with enough GPUs', () => {
    const gpu = { index: 0, name: 'NVIDIA H100 80GB', vram_mb: 81920 };
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'n1',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [
            { ...gpu, index: 0 },
            { ...gpu, index: 1 },
            { ...gpu, index: 2 },
          ],
        },
        {
          id: 'node-2',
          hostname: 'n2',
          ip: '10.0.0.2',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [
            { ...gpu, index: 0 },
            { ...gpu, index: 1 },
            { ...gpu, index: 2 },
          ],
        },
        {
          id: 'node-3',
          hostname: 'n3',
          ip: '10.0.0.3',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [
            { ...gpu, index: 0 },
            { ...gpu, index: 1 },
          ],
        },
      ],
    });
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'large' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.nodes_per_instance).toBe(2);
    expect(rec.warnings.some((w) => w.includes('multiple nodes'))).toBe(true);
  });

  it('raises context and GPUs for 32B Hugging Face models', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'Qwen/Qwen2.5-32B-Instruct' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.context_length).toBe(32768);
    expect(rec.gpus_per_instance).toBeGreaterThanOrEqual(2);
  });

  it('handles reserved GPUs and auto scale preset', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'solo',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 1,
          labels: [],
          status: 'online',
          gpus: [
            { index: 0, name: 'GPU', vram_mb: 8192 },
            { index: 1, name: 'GPU', vram_mb: 8192 },
          ],
        },
      ],
    });
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'auto' },
    });
    const rec = deriveRecommendation(dep, config);
    expect(rec.gpus_per_instance).toBe(1);
    expect(rec.instances).toBe(1);
  });
});