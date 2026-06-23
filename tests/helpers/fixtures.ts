import type { ApplianceConfig, DeploymentConfig } from '@/lib/types';

import { seedConfig } from '@/lib/mock/seed';

export function minimalConfig(overrides?: Partial<ApplianceConfig>): ApplianceConfig {
  return structuredClone({
    ...seedConfig,
    ...overrides,
    cluster: { ...seedConfig.cluster, ...overrides?.cluster },
    nodes: overrides?.nodes ?? structuredClone(seedConfig.nodes),
    deployments: overrides?.deployments ?? [],
    system: { ...seedConfig.system, ...overrides?.system },
    storage: { ...seedConfig.storage, ...overrides?.storage },
  });
}

export function sampleDeployment(overrides?: Partial<DeploymentConfig>): DeploymentConfig {
  return {
    id: 'dep-test',
    display_name: 'test-model',
    enabled: true,
    source: { type: 'huggingface', repo_id: 'meta-llama/Llama-3.1-8B-Instruct' },
    user_intent: { performance_goal: 'balanced', scale: 'medium' },
    parallelism: {
      context_length: 8192,
      quantization: null,
      instances: 1,
      gpus_per_instance: 1,
      nodes_per_instance: 1,
      autoscaling: null,
    },
    status: 'reconciling',
    ...overrides,
  };
}

export const v1Config = {
  version: 1 as const,
  appliance_id: 'legacy-001',
  cluster: {
    serving_mode: 'ray_cluster' as const,
    preferred_head_node_id: 'node-1',
    global_defaults: { autoscale_enabled: false },
  },
  nodes: [
    {
      id: 'node-1',
      hostname: 'head',
      ip: '10.0.0.1',
      roles: { head: true, litellm_proxy: false },
      gpus_reserved_for_system: 0,
      labels: [],
      status: 'online',
      gpus: [{ index: 0, name: 'GPU', vram_mb: 40960 }],
    },
  ],
  deployments: [
    {
      id: 'dep-legacy',
      display_name: 'legacy-model',
      enabled: true,
      source: { type: 'huggingface', repo_id: 'org/model-13b' },
      user_intent: { performance_goal: 'balanced', scale: 'small' },
      advanced: {
        context_length: 4096,
        num_replicas: 2,
        tensor_parallel_size: 1,
        pipeline_parallel_size: 1,
        autoscaling: { min_replicas: 1, max_replicas: 3, target_ongoing_requests: 4 },
      },
      status: 'healthy',
    },
  ],
  system: {
    network: { head_ip: '10.0.0.1', gateway: '10.0.0.254', dns: ['1.1.1.1'] },
    time: { ntp_servers: ['pool.ntp.org'] },
    security: { api_token_set: false },
  },
  storage: { mounts: [] },
};