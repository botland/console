import type {
  ApplianceConfig,
  HeadChangedPayload,
  MockState,
  NodeAgentState,
  ReconcileEvent,
} from '@/lib/types';

const now = Date.now();

const seedEvents: ReconcileEvent[] = [
  {
    id: 'evt-1',
    timestamp: new Date(now - 120_000).toISOString(),
    message: 'Appliance ready — 3 nodes online',
    level: 'info',
  },
  {
    id: 'evt-2',
    timestamp: new Date(now - 90_000).toISOString(),
    message: 'Deployment casperhansen/llama-3-8b-instruct-awq healthy on forge-worker-1 gpu0',
    level: 'info',
  },
  {
    id: 'evt-3',
    timestamp: new Date(now - 45_000).toISOString(),
    message: 'Federation diverse — manual placement on worker GPUs',
    level: 'info',
  },
];

export const seedConfig: ApplianceConfig = {
  version: 2,
  appliance_id: process.env.NEXT_PUBLIC_MOCK_APPLIANCE_ID ?? 'forge-demo-001',
  cluster: {
    serving_mode: 'distributed',
    compute_backend: 'federation',
    federation_layout: 'diverse',
    head_gpu: false,
    head_node_id: 'node-1',
    head_epoch: 1,
    global_defaults: { autoscale_enabled: true },
  },
  nodes: [
    {
      id: 'node-1',
      hostname: 'forge-head',
      ip: '192.168.1.10',
      is_head: true,
      gpus_reserved_for_system: 0,
      labels: ['coordinator'],
      status: 'online',
      gpus: [],
    },
    {
      id: 'node-2',
      hostname: 'forge-worker-1',
      ip: '192.168.1.11',
      is_head: false,
      gpus_reserved_for_system: 0,
      labels: ['inference'],
      status: 'online',
      gpus: [
        { index: 0, name: 'NVIDIA RTX 4090 24GB', vram_mb: 24576, utilization_pct: 71 },
      ],
    },
    {
      id: 'node-3',
      hostname: 'forge-worker-2',
      ip: '192.168.1.12',
      is_head: false,
      gpus_reserved_for_system: 0,
      labels: ['inference'],
      status: 'online',
      gpus: [
        { index: 0, name: 'NVIDIA RTX 4090 24GB', vram_mb: 24576, utilization_pct: 45 },
        { index: 1, name: 'NVIDIA RTX 4090 24GB', vram_mb: 24576, utilization_pct: 41 },
      ],
    },
  ],
  deployments: [
    {
      id: 'dep-llama-meta',
      display_name: 'meta-llama/Llama-3.1-8B-Instruct',
      enabled: false,
      source: { type: 'huggingface', repo_id: 'meta-llama/Llama-3.1-8B-Instruct' },
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
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
      status: 'stopped',
    },
    {
      id: 'dep-awq-casper',
      display_name: 'casperhansen/llama-3-8b-instruct-awq',
      enabled: true,
      source: { type: 'huggingface', repo_id: 'casperhansen/llama-3-8b-instruct-awq' },
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
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
        targets: [{ node_id: 'node-2', gpu_indices: [0] }],
      },
      status: 'healthy',
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

function headPayload(config: ApplianceConfig): HeadChangedPayload {
  const head = config.nodes.find((n) => n.id === config.cluster.head_node_id);
  return {
    head_node_id: config.cluster.head_node_id,
    head_ip: head?.ip ?? config.system.network.head_ip,
    head_epoch: config.cluster.head_epoch,
  };
}

function seedAgents(config: ApplianceConfig): Record<string, NodeAgentState> {
  const now = Date.now();
  const headId = config.cluster.head_node_id;
  const agents: Record<string, NodeAgentState> = {};
  for (const node of config.nodes) {
    agents[node.id] = {
      node_id: node.id,
      last_seen: now,
      heartbeat_ts: now,
      agent_phase: node.status === 'online' ? 'running' : 'idle',
      head_target_node_id: headId,
    };
  }
  return agents;
}

export function createSeedState(): MockState {
  const config = structuredClone(seedConfig);
  return {
    config,
    local_node_id: 'node-1',
    agents: seedAgents(config),
    status: {
      state: 'READY',
      last_error: null,
      last_reconcile_ts: now / 1000,
      events: [...seedEvents],
      head: headPayload(seedConfig),
    },
    storage_usage: {
      total_bytes: 8 * 1024 ** 4,
      used_bytes: Math.floor(4.2 * 1024 ** 4),
      paths: {
        '/models/hf-cache': [
          { name: 'meta-llama--Llama-3.1-8B-Instruct', size_bytes: 16e9, type: 'dir' },
          { name: 'casperhansen--llama-3-8b-instruct-awq', size_bytes: 6e9, type: 'dir' },
        ],
        '/models/uploads': [{ name: 'my-finetuned-llama', size_bytes: 15e9, type: 'dir' }],
        '/models/customer-nfs': [
          { name: 'llama-finetuned-v2', size_bytes: 15e9, type: 'dir' },
        ],
      },
    },
  };
}