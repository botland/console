import type {
  ApplianceConfig,
  DeploymentConfig,
  PlannerRecommendation,
  ServingMode,
} from '@/lib/types';

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

  let tensor_parallel_size = Math.min(4, perNode);
  let pipeline_parallel_size = 1;
  let num_replicas = Math.min(mult, Math.max(1, Math.floor(gpus / tensor_parallel_size)));
  let context_length = 8192;

  switch (deployment.user_intent.performance_goal) {
    case 'max_throughput':
      num_replicas = Math.max(num_replicas, 2);
      tensor_parallel_size = Math.min(2, perNode);
      break;
    case 'low_latency':
      num_replicas = 1;
      tensor_parallel_size = Math.min(2, perNode);
      context_length = 4096;
      break;
    case 'high_availability':
      num_replicas = Math.max(2, mult);
      break;
    case 'balanced':
    default:
      break;
  }

  if (mode === 'litellm_standalone') {
    if (tensor_parallel_size > perNode) {
      tensor_parallel_size = perNode;
      warnings.push(`TP capped at ${perNode} GPUs (single-node limit in LiteLLM mode)`);
    }
    if (pipeline_parallel_size > 1) {
      pipeline_parallel_size = 1;
      warnings.push('Pipeline parallelism disabled in LiteLLM standalone mode');
    }
  } else if (gpus >= 8 && deployment.user_intent.scale === 'large') {
    pipeline_parallel_size = 2;
    warnings.push('Cross-node pipeline parallelism enabled for large scale');
  }

  if (deployment.source.type === 'huggingface' && deployment.source.repo_id.includes('32B')) {
    context_length = 32768;
    tensor_parallel_size = Math.max(tensor_parallel_size, Math.min(4, perNode));
  }

  if (mode === 'litellm_standalone' && tensor_parallel_size > perNode) {
    warnings.push('Cross-node TP requires Ray cluster mode');
  }

  return {
    num_replicas,
    tensor_parallel_size,
    pipeline_parallel_size,
    context_length,
    warnings,
  };
}