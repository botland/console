import { describe, expect, it } from 'vitest';

import { minimalConfig, sampleDeployment } from '@/tests/helpers/fixtures';

import { validateDeployment } from '@/lib/validation/feasibility';

describe('validateDeployment', () => {
  it('accepts a feasible deployment', () => {
    const config = minimalConfig();
    const dep = sampleDeployment();
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.suggested).toBeDefined();
    expect(result.inventory).toBeDefined();
  });

  it('rejects when head is offline', () => {
    const config = minimalConfig({
      nodes: minimalConfig().nodes.map((n) =>
        n.id === 'node-1' ? { ...n, status: 'offline' as const } : n,
      ),
    });
    const result = validateDeployment(sampleDeployment(), config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Head node');
  });

  it('rejects insufficient GPUs', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 10,
        gpus_per_instance: 4,
        nodes_per_instance: 1,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('needs 40 GPUs');
  });

  it('rejects multi-node instances in standalone mode', () => {
    const config = minimalConfig({
      cluster: {
        serving_mode: 'standalone',
        head_node_id: 'node-1',
        head_epoch: 1,
        global_defaults: { autoscale_enabled: false },
      },
    });
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 2,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Standalone mode'))).toBe(true);
  });

  it('warns on autoscale peak GPU demand', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 2,
        nodes_per_instance: 1,
        autoscaling: { min_instances: 1, max_instances: 10, target_ongoing_requests: 8 },
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.warnings.some((w) => w.includes('Autoscale may request'))).toBe(true);
  });

  it('rejects invalid autoscale bounds and relative local paths', () => {
    const config = minimalConfig();
    const dep = sampleDeployment({
      display_name: '  ',
      source: { type: 'local_path', path: 'models/foo' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        autoscaling: { min_instances: 5, max_instances: 2, target_ongoing_requests: 8 },
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Autoscale minimum instances cannot exceed maximum.',
        'Local model path must be an absolute path.',
        'Display name is required.',
      ]),
    );
  });

  it('rejects standalone deployments exceeding per-node GPU capacity', () => {
    const config = minimalConfig({
      cluster: {
        serving_mode: 'standalone',
        head_node_id: 'node-1',
        head_epoch: 1,
        global_defaults: { autoscale_enabled: false },
      },
    });
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 4,
        nodes_per_instance: 1,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('largest node'))).toBe(true);
  });

  it('rejects distributed deployments spanning too many nodes', () => {
    const config = minimalConfig({
      nodes: minimalConfig().nodes.map((n) =>
        n.id === 'node-3' ? { ...n, status: 'offline' as const } : n,
      ),
    });
    const dep = sampleDeployment({
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 3,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('spans 3 nodes'))).toBe(true);
  });

  it('estimates VRAM for 7B and default model sizes', () => {
    const config = minimalConfig();
    expect(
      validateDeployment(
        sampleDeployment({ source: { type: 'huggingface', repo_id: 'org/Llama-7b' } }),
        config,
      ).suggested,
    ).toBeDefined();
    expect(
      validateDeployment(
        sampleDeployment({ source: { type: 'huggingface', repo_id: 'org/Unknown-Model' } }),
        config,
      ).suggested,
    ).toBeDefined();
  });

  it('estimates VRAM for 32B and 8B models', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'small',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'Small GPU', vram_mb: 4096 }],
        },
      ],
    });
    const result32 = validateDeployment(
      sampleDeployment({ source: { type: 'huggingface', repo_id: 'org/Qwen-32b' } }),
      config,
    );
    expect(result32.errors.some((e) => e.includes('Estimated model weights'))).toBe(true);

    const result8 = validateDeployment(
      sampleDeployment({ source: { type: 'huggingface', repo_id: 'meta-llama/Llama-8b' } }),
      config,
    );
    expect(result8.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('estimates VRAM for 13B models', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'small',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'Small GPU', vram_mb: 4096 }],
        },
      ],
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'org/Llama-13b' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.errors.some((e) => e.includes('Estimated model weights'))).toBe(true);
  });

  it('warns when estimated VRAM may not fit', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'small',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'Small GPU', vram_mb: 4096 }],
        },
      ],
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'org/Llama-70b' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        autoscaling: null,
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.errors.some((e) => e.includes('Estimated model weights'))).toBe(true);
  });

  it('requires placement targets when deployment placement mode is manual', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
      },
    });
    const dep = sampleDeployment({ placement: { mode: 'manual' } });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('placement');
  });

  it('accepts explicit placement targets in manual federation mode', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
      },
    });
    const dep = sampleDeployment({
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-2', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.includes('VRAM likely insufficient'))).toBe(false);
  });

  it('skips placement validation when deployment placement mode is auto', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
      },
    });
    const dep = sampleDeployment({ placement: { mode: 'auto' } });
    const result = validateDeployment(dep, config, {
      ...config.cluster,
      federation_auto_placement: false,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects cluster peak GPU demand across deployments with PP', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'cluster',
      },
      deployments: [
        sampleDeployment({
          id: 'dep-a',
          parallelism: {
            context_length: 8192,
            quantization: null,
            instances: 1,
            gpus_per_instance: 4,
            nodes_per_instance: 2,
            autoscaling: null,
          },
        }),
      ],
    });
    const depB = sampleDeployment({
      id: 'dep-b',
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 4,
        nodes_per_instance: 2,
        autoscaling: null,
      },
    });
    const result = validateDeployment(depB, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at peak'))).toBe(true);
  });

  it('ignores disabled deployments when checking GPU utilization budget', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
      },
      deployments: [
        sampleDeployment({
          id: 'dep-a',
          display_name: 'casperhansen/llama-3-8b-instruct-awq',
          enabled: false,
          parallelism: {
            context_length: 8192,
            quantization: null,
            instances: 1,
            gpus_per_instance: 1,
            nodes_per_instance: 1,
            gpu_utilization: 0.85,
            autoscaling: null,
          },
          placement: {
            mode: 'manual',
            targets: [{ node_id: 'node-2', gpu_indices: [0] }],
          },
        }),
      ],
    });
    const depB = sampleDeployment({
      id: 'dep-b',
      display_name: 'meta-llama/Llama-3.1-8B-Instruct',
      enabled: true,
      parallelism: {
        context_length: 4096,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        gpu_utilization: 0.85,
        autoscaling: null,
      },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-2', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(depB, config);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.includes('exceeds 100%'))).toBe(false);
    expect(result.errors.some((e) => e.includes('VRAM likely insufficient'))).toBe(false);
  });

  it('rejects combined GPU utilization above 100% across deployments', () => {
    const config = minimalConfig({
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
      },
      deployments: [
        sampleDeployment({
          id: 'dep-a',
          display_name: 'model-a',
          parallelism: {
            context_length: 8192,
            quantization: null,
            instances: 1,
            gpus_per_instance: 1,
            nodes_per_instance: 1,
            gpu_utilization: 0.6,
            autoscaling: null,
          },
          placement: {
            mode: 'manual',
            targets: [{ node_id: 'node-2', gpu_indices: [0] }],
          },
        }),
      ],
    });
    const depB = sampleDeployment({
      id: 'dep-b',
      display_name: 'model-b',
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        gpu_utilization: 0.6,
        autoscaling: null,
      },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-2', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(depB, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds 100%'))).toBe(true);
  });

  it('rejects AWQ deployment when KV cache exceeds 8 GB GPU budget', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-head',
          hostname: 'sak',
          ip: '192.168.1.143',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [],
        },
        {
          id: 'node-worker',
          hostname: 'kas',
          ip: '192.168.1.144',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [
            {
              index: 0,
              name: 'NVIDIA GeForce RTX 3070 Ti',
              vram_mb: 8 * 1024,
            },
          ],
        },
      ],
      cluster: {
        ...minimalConfig().cluster,
        serving_mode: 'distributed',
        compute_backend: 'federation',
        federation_layout: 'diverse',
        head_node_id: 'node-head',
        head_gpu: false,
      },
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'casperhansen/llama-3-8b-instruct-awq' },
      parallelism: {
        context_length: 8192,
        quantization: 'awq',
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        gpu_utilization: 0.85,
        autoscaling: null,
      },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-worker', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(dep, config, config.cluster);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('VRAM likely insufficient'))).toBe(true);
  });

  it('uses quantized weight estimate on AWQ models (not fp16 16 GB)', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-worker',
          hostname: 'kas',
          ip: '192.168.1.144',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 3070 Ti', vram_mb: 8 * 1024 }],
        },
      ],
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'casperhansen/llama-3-8b-instruct-awq' },
      parallelism: {
        context_length: 4096,
        quantization: 'awq',
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        gpu_utilization: 0.85,
        autoscaling: null,
      },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-worker', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.warnings.some((w) => w.includes('16 GB'))).toBe(false);
    expect(result.warnings.some((w) => w.includes('Estimated model weights'))).toBe(false);
  });

  it('rejects fp16 weights that exceed GPU VRAM with a single error', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-worker',
          hostname: 'kas',
          ip: '192.168.1.144',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 3070 Ti', vram_mb: 8 * 1024 }],
        },
      ],
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'meta-llama/Llama-3.1-8B-Instruct' },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-worker', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Estimated model weights (~16.0 GB)'))).toBe(true);
    expect(result.errors.some((e) => e.includes('KV cache'))).toBe(false);
  });

  it('rejects deepseek 6.7b fp16 on 8 GB without duplicate KV message', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-head',
          hostname: 'sak',
          ip: '192.168.1.143',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [],
        },
        {
          id: 'node-worker',
          hostname: 'kas',
          ip: '192.168.1.144',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 3070 Ti', vram_mb: 8 * 1024 }],
        },
      ],
      cluster: {
        ...minimalConfig().cluster,
        head_node_id: 'node-head',
        head_gpu: false,
      },
    });
    const dep = sampleDeployment({
      source: { type: 'huggingface', repo_id: 'deepseek-ai/deepseek-coder-6.7b-instruct' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        gpu_utilization: 0.85,
        autoscaling: null,
      },
      placement: {
        mode: 'manual',
        targets: [{ node_id: 'node-worker', gpu_indices: [0] }],
      },
    });
    const result = validateDeployment(dep, config);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Estimated model weights (~13.4 GB)');
    expect(result.errors[0]).toContain('quantized');
  });
});