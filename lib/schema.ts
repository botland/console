import { z } from 'zod';

const gpuSchema = z.object({
  index: z.number(),
  name: z.string(),
  vram_mb: z.number(),
  utilization_pct: z.number().optional(),
  vram_used_mb: z.number().optional(),
});

const nodeSchema = z.object({
  id: z.string(),
  hostname: z.string(),
  ip: z.string(),
  is_head: z.boolean(),
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
  parallelism: z.object({
    context_length: z.number().min(512),
    quantization: z.string().nullable(),
    instances: z.number().min(1),
    gpus_per_instance: z.number().min(1),
    nodes_per_instance: z.number().min(1),
    autoscaling: z
      .object({
        min_instances: z.number().min(1),
        max_instances: z.number().min(1),
        target_ongoing_requests: z.number().min(1),
      })
      .nullable(),
  }),
  status: z.enum(['healthy', 'reconciling', 'degraded', 'stopped', 'error']),
});

export const applianceConfigSchemaV2 = z.object({
  version: z.literal(2),
  appliance_id: z.string().min(1),
  cluster: z.object({
    serving_mode: z.enum(['distributed', 'standalone']),
    head_node_id: z.string(),
    head_epoch: z.number().min(1),
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

/** Accept v1 configs from USB/import and normalize to v2 */
const applianceConfigSchemaV1 = z.object({
  version: z.literal(1),
  appliance_id: z.string(),
  cluster: z.object({
    serving_mode: z.enum(['ray_cluster', 'litellm_standalone']),
    preferred_head_node_id: z.string(),
    global_defaults: z.object({ autoscale_enabled: z.boolean() }),
  }),
  nodes: z.array(z.any()),
  deployments: z.array(z.any()),
  system: z.any(),
  storage: z.any(),
});

export function migrateConfigV1ToV2(raw: z.infer<typeof applianceConfigSchemaV1>): z.infer<typeof applianceConfigSchemaV2> {
  const serving_mode = raw.cluster.serving_mode === 'ray_cluster' ? 'distributed' : 'standalone';
  const head_node_id = raw.cluster.preferred_head_node_id;

  const nodes = (raw.nodes as Record<string, unknown>[]).map((n) => ({
    id: String(n.id),
    hostname: String(n.hostname),
    ip: String(n.ip),
    is_head: n.id === head_node_id || (n.roles as { head?: boolean })?.head === true,
    gpus_reserved_for_system: Number(n.gpus_reserved_for_system ?? 0),
    labels: (n.labels as string[]) ?? [],
    status: (n.status as 'online' | 'offline' | 'degraded') ?? 'online',
    gpus: (n.gpus as object[]) ?? [],
  }));

  const deployments = (raw.deployments as Record<string, unknown>[]).map((d) => {
    const adv = (d.advanced ?? d.parallelism ?? {}) as Record<string, unknown>;
    const autoscaling = adv.autoscaling as Record<string, number> | null;
    return {
      id: String(d.id),
      display_name: String(d.display_name),
      enabled: Boolean(d.enabled),
      source: d.source,
      user_intent: d.user_intent,
      parallelism: {
        context_length: Number(adv.context_length ?? 8192),
        quantization: (adv.quantization as string | null) ?? null,
        instances: Number(adv.num_replicas ?? adv.instances ?? 1),
        gpus_per_instance: Number(adv.tensor_parallel_size ?? adv.gpus_per_instance ?? 1),
        nodes_per_instance: Number(adv.pipeline_parallel_size ?? adv.nodes_per_instance ?? 1),
        autoscaling: autoscaling
          ? {
              min_instances: autoscaling.min_replicas ?? autoscaling.min_instances ?? 1,
              max_instances: autoscaling.max_replicas ?? autoscaling.max_instances ?? 1,
              target_ongoing_requests: autoscaling.target_ongoing_requests ?? 8,
            }
          : null,
      },
      status: d.status ?? 'stopped',
    };
  });

  return {
    version: 2,
    appliance_id: raw.appliance_id,
    cluster: {
      serving_mode: serving_mode as 'distributed' | 'standalone',
      head_node_id,
      head_epoch: 1,
      global_defaults: raw.cluster.global_defaults,
    },
    nodes: nodes as z.infer<typeof applianceConfigSchemaV2>['nodes'],
    deployments: deployments as z.infer<typeof applianceConfigSchemaV2>['deployments'],
    system: raw.system as z.infer<typeof applianceConfigSchemaV2>['system'],
    storage: raw.storage as z.infer<typeof applianceConfigSchemaV2>['storage'],
  };
}

export function parseApplianceConfig(input: unknown): z.infer<typeof applianceConfigSchemaV2> {
  const v2 = applianceConfigSchemaV2.safeParse(input);
  if (v2.success) return v2.data;

  const v1 = applianceConfigSchemaV1.safeParse(input);
  if (v1.success) return applianceConfigSchemaV2.parse(migrateConfigV1ToV2(v1.data));

  throw new Error('Invalid appliance configuration');
}

export const applianceConfigSchema = applianceConfigSchemaV2;
export type ApplianceConfigInput = z.infer<typeof applianceConfigSchemaV2>;