import { describe, expect, it } from 'vitest';

import { minimalConfig, v1Config } from '@/tests/helpers/fixtures';

import {
  migrateConfigV1ToV2,
  parseApplianceConfig,
} from '@/lib/schema';

describe('schema', () => {
  it('parses valid v2 config', () => {
    const parsed = parseApplianceConfig(minimalConfig());
    expect(parsed.version).toBe(2);
    expect(parsed.cluster.serving_mode).toBe('distributed');
  });

  it('migrates v1 ray_cluster config to v2 distributed', () => {
    const migrated = migrateConfigV1ToV2(v1Config);
    expect(migrated.version).toBe(2);
    expect(migrated.cluster.serving_mode).toBe('distributed');
    expect(migrated.cluster.head_node_id).toBe('node-1');
    expect(migrated.cluster.head_epoch).toBe(1);
    expect(migrated.deployments[0].parallelism.instances).toBe(2);
    expect(migrated.deployments[0].parallelism.autoscaling?.max_instances).toBe(3);
    expect(migrated.nodes[0].is_head).toBe(true);
  });

  it('migrates litellm_standalone to standalone via parseApplianceConfig', () => {
    const parsed = parseApplianceConfig({
      ...v1Config,
      cluster: {
        ...v1Config.cluster,
        serving_mode: 'litellm_standalone',
      },
    });
    expect(parsed.cluster.serving_mode).toBe('standalone');
  });

  it('maps parallelism fields from v1 advanced block', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      deployments: [
        {
          ...v1Config.deployments[0],
          advanced: undefined,
          parallelism: {
            context_length: 16384,
            instances: 3,
            gpus_per_instance: 2,
            nodes_per_instance: 2,
            quantization: 'fp8',
            autoscaling: { min_instances: 2, max_instances: 4, target_ongoing_requests: 6 },
          },
        },
      ],
    });
    expect(migrated.deployments[0].parallelism.context_length).toBe(16384);
    expect(migrated.deployments[0].parallelism.instances).toBe(3);
    expect(migrated.deployments[0].parallelism.gpus_per_instance).toBe(2);
    expect(migrated.deployments[0].parallelism.nodes_per_instance).toBe(2);
    expect(migrated.deployments[0].parallelism.quantization).toBe('fp8');
  });

  it('migrates v1 deployments without autoscaling', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      deployments: [
        {
          ...v1Config.deployments[0],
          advanced: {
            context_length: 8192,
            num_replicas: 1,
            tensor_parallel_size: 1,
            pipeline_parallel_size: 1,
          },
        },
      ],
    });
    expect(migrated.deployments[0].parallelism.autoscaling).toBeNull();
  });

  it('maps legacy autoscaling replica field names', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      deployments: [
        {
          ...v1Config.deployments[0],
          advanced: {
            autoscaling: { min_replicas: 2, max_replicas: 5 },
          },
        },
      ],
    });
    expect(migrated.deployments[0].parallelism.autoscaling).toEqual({
      min_instances: 2,
      max_instances: 5,
      target_ongoing_requests: 8,
    });
  });

  it('normalizes v1 nodes and deployments with alternate field names', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      nodes: [
        {
          id: 'node-2',
          hostname: 'worker',
          ip: '10.0.0.2',
          roles: { head: true },
          gpus_reserved_for_system: 1,
          labels: ['gpu'],
          status: 'degraded',
          gpus: [{ index: 0, name: 'GPU', vram_mb: 8192 }],
        },
      ],
      deployments: [
        {
          id: 'dep-alt',
          display_name: 'alt',
          enabled: false,
          source: { type: 'local_path', path: '/models/x' },
          user_intent: { performance_goal: 'balanced', scale: 'auto' },
          parallelism: {
            context_length: 2048,
            instances: 4,
            gpus_per_instance: 2,
            nodes_per_instance: 2,
            quantization: 'int8',
            autoscaling: {
              min_instances: 1,
              max_instances: 2,
              target_ongoing_requests: 3,
            },
          },
        },
      ],
    });
    expect(migrated.nodes[0].is_head).toBe(true);
    expect(migrated.nodes[0].gpus_reserved_for_system).toBe(1);
    expect(migrated.deployments[0].parallelism.instances).toBe(4);
    expect(migrated.deployments[0].parallelism.autoscaling?.target_ongoing_requests).toBe(3);
    expect(migrated.deployments[0].status).toBe('stopped');
  });

  it('fills v1 defaults for sparse node and advanced-only deployments', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      nodes: [
        {
          id: 'node-1',
          hostname: 'head',
          ip: '10.0.0.1',
          roles: {},
        },
      ],
      deployments: [
        {
          id: 'dep-advanced-only',
          display_name: 'adv',
          enabled: true,
          source: { type: 'huggingface', repo_id: 'org/model' },
          user_intent: { performance_goal: 'balanced', scale: 'small' },
          advanced: {
            num_replicas: 1,
            tensor_parallel_size: 1,
            pipeline_parallel_size: 1,
            autoscaling: { min_instances: 2, max_instances: 4 },
          },
        },
      ],
    });
    expect(migrated.nodes[0].gpus).toEqual([]);
    expect(migrated.nodes[0].labels).toEqual([]);
    expect(migrated.deployments[0].parallelism.autoscaling).toEqual({
      min_instances: 2,
      max_instances: 4,
      target_ongoing_requests: 8,
    });
  });

  it('covers remaining v1 coalesce branches', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      nodes: [
        {
          id: 'node-1',
          hostname: 'head',
          ip: '10.0.0.1',
          roles: { head: false },
          labels: ['primary'],
          gpus_reserved_for_system: 0,
          gpus: [],
        },
      ],
      deployments: [
        {
          id: 'dep-bare',
          display_name: 'bare',
          enabled: false,
          source: { type: 'huggingface', repo_id: 'org/model' },
          user_intent: { performance_goal: 'balanced', scale: 'small' },
        },
        {
          id: 'dep-autoscale-defaults',
          display_name: 'scale',
          enabled: true,
          source: { type: 'huggingface', repo_id: 'org/model' },
          user_intent: { performance_goal: 'balanced', scale: 'small' },
          advanced: { autoscaling: {} },
        },
      ],
    });
    expect(migrated.nodes[0].is_head).toBe(true);
    expect(migrated.nodes[0].labels).toEqual(['primary']);
    expect(migrated.deployments[0].parallelism.instances).toBe(1);
    expect(migrated.deployments[1].parallelism.autoscaling).toEqual({
      min_instances: 1,
      max_instances: 1,
      target_ongoing_requests: 8,
    });
  });

  it('throws on invalid config', () => {
    expect(() => parseApplianceConfig({ version: 99 })).toThrow('Invalid appliance configuration');
  });
});