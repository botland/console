import type { ApplianceConfig, MockState, ReconcileEvent } from '@/lib/types';

const now = Date.now();

const seedEvents: ReconcileEvent[] = [
  {
    id: 'evt-1',
    timestamp: new Date(now - 120_000).toISOString(),
    message: 'Cluster ready — 3 nodes online',
    level: 'info',
  },
  {
    id: 'evt-2',
    timestamp: new Date(now - 90_000).toISOString(),
    message: 'Deployment qwen2.5-32b healthy on 2 replicas',
    level: 'info',
  },
  {
    id: 'evt-3',
    timestamp: new Date(now - 45_000).toISOString(),
    message: 'GPU utilization nominal across workers',
    level: 'info',
  },
];

export const seedConfig: ApplianceConfig = {
  version: 1,
  appliance_id: process.env.NEXT_PUBLIC_MOCK_APPLIANCE_ID ?? 'forge-demo-001',
  cluster: {
    serving_mode: 'ray_cluster',
    preferred_head_node_id: 'node-1',
    global_defaults: { autoscale_enabled: true },
  },
  nodes: [
    {
      id: 'node-1',
      hostname: 'forge-head',
      ip: '192.168.1.10',
      roles: { head: true, litellm_proxy: false },
      gpus_reserved_for_system: 0,
      labels: ['high-bandwidth'],
      status: 'online',
      gpus: [
        { index: 0, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 62 },
        { index: 1, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 58 },
      ],
    },
    {
      id: 'node-2',
      hostname: 'forge-worker-1',
      ip: '192.168.1.11',
      roles: { head: false, litellm_proxy: false },
      gpus_reserved_for_system: 0,
      labels: ['inference'],
      status: 'online',
      gpus: [
        { index: 0, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 71 },
        { index: 1, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 69 },
      ],
    },
    {
      id: 'node-3',
      hostname: 'forge-worker-2',
      ip: '192.168.1.12',
      roles: { head: false, litellm_proxy: false },
      gpus_reserved_for_system: 1,
      labels: ['storage'],
      status: 'online',
      gpus: [
        { index: 0, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 45 },
        { index: 1, name: 'NVIDIA H100 80GB', vram_mb: 81920, utilization_pct: 41 },
      ],
    },
  ],
  deployments: [
    {
      id: 'dep-qwen-32b',
      display_name: 'qwen2.5-32b',
      enabled: true,
      source: { type: 'huggingface', repo_id: 'Qwen/Qwen2.5-32B-Instruct' },
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
      advanced: {
        context_length: 32768,
        quantization: null,
        num_replicas: 2,
        tensor_parallel_size: 4,
        pipeline_parallel_size: 1,
        autoscaling: { min_replicas: 1, max_replicas: 4, target_ongoing_requests: 8 },
      },
      status: 'healthy',
    },
    {
      id: 'dep-llama-8b',
      display_name: 'llama-3.1-8b',
      enabled: false,
      source: { type: 'local_path', path: '/models/customer-nfs/llama-finetuned-v2' },
      user_intent: { performance_goal: 'low_latency', scale: 'small' },
      advanced: {
        context_length: 8192,
        quantization: 'awq',
        num_replicas: 1,
        tensor_parallel_size: 1,
        pipeline_parallel_size: 1,
        autoscaling: null,
      },
      status: 'stopped',
    },
  ],
  system: {
    network: {
      head_ip: '192.168.1.10',
      gateway: '192.168.1.1',
      dns: ['1.1.1.1', '8.8.8.8'],
    },
    time: { ntp_servers: ['pool.ntp.org', 'time.google.com'] },
    security: { api_token_set: true },
  },
  storage: {
    mounts: [
      {
        id: 'mount-nfs-1',
        type: 'nfs',
        remote: '192.168.1.100:/models',
        local_path: '/models/customer-nfs',
      },
    ],
  },
};

export function createSeedState(): MockState {
  return {
    config: structuredClone(seedConfig),
    status: {
      state: 'READY',
      last_error: null,
      last_reconcile_ts: now / 1000,
      events: [...seedEvents],
    },
    storage_usage: {
      total_bytes: 8 * 1024 ** 4,
      used_bytes: Math.floor(4.2 * 1024 ** 4),
      paths: {
        '/models/hf-cache': [
          { name: 'Qwen--Qwen2.5-32B-Instruct', size_bytes: 65e9, type: 'dir' },
          { name: 'meta-llama--Llama-3.1-8B-Instruct', size_bytes: 16e9, type: 'dir' },
        ],
        '/models/uploads': [
          { name: 'my-finetuned-llama', size_bytes: 15e9, type: 'dir' },
        ],
        '/models/customer-nfs': [
          { name: 'llama-finetuned-v2', size_bytes: 15e9, type: 'dir' },
          { name: 'qwen-custom', size_bytes: 62e9, type: 'dir' },
        ],
      },
    },
  };
}