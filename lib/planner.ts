import type {
  ApplianceConfig,
  DeploymentConfig,
  PlannerRecommendation,
  ServingMode,
} from '@/lib/types';

import { resolvePlacementVramMb } from '@/lib/validation/placement-vram';
import {
  capContextLength,
  estimateWeightGb,
  weightsExceedGpuVram,
} from '@/lib/validation/vram';

function totalGpus(config: ApplianceConfig): number {
  return config.nodes.reduce(
    (sum, n) => sum + Math.max(0, n.gpus.length - n.gpus_reserved_for_system),
    0,
  );
}

function maxGpusPerNode(config: ApplianceConfig): number {
  return Math.max(
    1,
    ...config.nodes.map((n) => Math.max(0, n.gpus.length - n.gpus_reserved_for_system)),
  );
}

function scaleMultiplier(scale: DeploymentConfig['user_intent']['scale']): number {
  switch (scale) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
    case 'auto':
      return 2;
  }
}

export function deriveRecommendation(
  deployment: DeploymentConfig,
  config: ApplianceConfig,
): PlannerRecommendation {
  const mode: ServingMode = config.cluster.serving_mode;
  const gpus = totalGpus(config);
  const perNode = maxGpusPerNode(config);
  const mult = scaleMultiplier(deployment.user_intent.scale);
  const warnings: string[] = [];

  let gpus_per_instance = Math.min(4, perNode);
  let nodes_per_instance = 1;
  let instances = Math.min(mult, Math.max(1, Math.floor(gpus / gpus_per_instance)));
  let context_length = 8192;

  switch (deployment.user_intent.performance_goal) {
    case 'max_throughput':
      instances = Math.max(instances, 2);
      gpus_per_instance = Math.min(2, perNode);
      break;
    case 'low_latency':
      instances = 1;
      gpus_per_instance = Math.min(2, perNode);
      context_length = 4096;
      break;
    case 'high_availability':
      instances = Math.max(2, mult);
      break;
    case 'balanced':
    default:
      break;
  }

  if (mode === 'standalone') {
    nodes_per_instance = 1;
  } else if (gpus >= 8 && deployment.user_intent.scale === 'large') {
    nodes_per_instance = 2;
    warnings.push('Large scale may span multiple nodes in distributed mode');
  }

  if (deployment.source.type === 'huggingface' && deployment.source.repo_id.includes('32B')) {
    context_length = 32768;
    gpus_per_instance = Math.max(gpus_per_instance, Math.min(4, perNode));
  }

  if (deployment.source.type === 'huggingface') {
    const modelId = deployment.source.repo_id.trim();
    const util = deployment.parallelism.gpu_utilization ?? 0.85;
    const hasPlacement = (deployment.placement?.targets?.length ?? 0) > 0;
    const vramMb = resolvePlacementVramMb(deployment, config, gpus_per_instance);
    if (modelId && vramMb) {
      const weightGb = estimateWeightGb(modelId);
      if (weightGb !== null && weightsExceedGpuVram(modelId, vramMb, gpus_per_instance)) {
        warnings.push(
          `Model weights (~${weightGb.toFixed(1)} GB) exceed target GPU (${Math.round(vramMb / 1024)} GB). ` +
            `Use a quantized model, a smaller model, or more GPUs per instance.`,
        );
        if (hasPlacement) {
          context_length = 512;
        }
      } else {
        const capped = capContextLength(modelId, context_length, util, vramMb);
        if (capped < context_length) {
          warnings.push(`Context capped to ${capped} tokens for GPU memory on target hardware.`);
          context_length = capped;
        }
      }
    }
  }

  return {
    instances,
    gpus_per_instance,
    nodes_per_instance,
    context_length,
    warnings,
  };
}