import { z } from 'zod';

const gpuSchema = z.object({
  index: z.number(),
  name: z.string(),
  vram_mb: z.number(),
  utilization_pct: z.number().optional(),
});

const nodeSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  ip: z.string(),
  roles: z.object({
    head: z.boolean(),
    litellm_proxy: z.boolean(),
  }),
  gpus_reserved_for_system: z.number().min(0),
  labels: z.array(z.string()),
  status: z.enum(['online', 'offline', 'degraded']),
  gpus: z.array(gpuSchema),
});

const sourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('huggingface'),
    repo_id: z.string().min(1),
    hf_token: z.string().optional(),
  }),
  z.object({
    type: z.literal('local_path'),
    path: z.string().min(1),
  }),
]);

const deploymentSchema = z.object({
  id: z.string(),
  display_name: z.string().min(1),
  enabled: z.boolean(),
  source: sourceSchema,
  user_intent: z.object({
    performance_goal: z.enum(['balanced', 'max_throughput', 'low_latency', 'high_availability']),
    scale: z.enum(['small', 'medium', 'large', 'auto']),
  }),
  advanced: z.object({
    context_length: z.number().min(512),
    quantization: z.string().nullable(),
    num_replicas: z.number().min(1),
    tensor_parallel_size: z.number().min(1),
    pipeline_parallel_size: z.number().min(1),
    autoscaling: z
      .object({
        min_replicas: z.number().min(1),
        max_replicas: z.number().min(1),
        target_ongoing_requests: z.number().min(1),
      })
      .nullable(),
  }),
  status: z.enum(['healthy', 'reconciling', 'degraded', 'stopped', 'error']),
});

export const applianceConfigSchema = z.object({
  version: z.literal(1),
  appliance_id: z.string().min(1),
  cluster: z.object({
    serving_mode: z.enum(['ray_cluster', 'litellm_standalone']),
    preferred_head_node_id: z.string(),
    global_defaults: z.object({
      autoscale_enabled: z.boolean(),
    }),
  }),
  nodes: z.array(nodeSchema).min(1),
  deployments: z.array(deploymentSchema),
  system: z.object({
    network: z.object({
      head_ip: z.string(),
      gateway: z.string(),
      dns: z.array(z.string()),
    }),
    time: z.object({
      ntp_servers: z.array(z.string()),
    }),
    security: z.object({
      api_token_set: z.boolean(),
    }),
  }),
  storage: z.object({
    mounts: z.array(
      z.object({
        id: z.string(),
        type: z.enum(['nfs', 'smb', 's3']),
        remote: z.string(),
        local_path: z.string(),
      }),
    ),
  }),
});

export type ApplianceConfigInput = z.infer<typeof applianceConfigSchema>;