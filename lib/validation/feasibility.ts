import {
  availableGpus,
  deploymentUsesManualPlacement,
  resolveDeploymentFormMode,
} from '@/lib/deployment-ui';
import { resolveComputeBackend } from '@/lib/orchestration';
import { deriveRecommendation } from '@/lib/planner';
import type { ApplianceConfig, DeploymentConfig, OrchestrationConfig, ValidationResult } from '@/lib/types';

import { effectiveInstances, peakGpuDemand } from '@/lib/parallelism';

import { buildInventory } from './inventory';

const DEFAULT_GPU_UTILIZATION = 0.85;

function estimateModelVramMb(deployment: DeploymentConfig): number {
  if (deployment.source.type === 'local_path') return 16_000;
  const repo = deployment.source.repo_id.toLowerCase();
  if (repo.includes('70b')) return 140_000;
  if (repo.includes('32b')) return 64_000;
  if (repo.includes('13b')) return 26_000;
  if (repo.includes('8b') || repo.includes('7b')) return 16_000;
  return 24_000;
}

function minVramOnNode(config: ApplianceConfig, gpusNeeded: number): number {
  const perNodeVrams = config.nodes
    .filter((n) => n.status === 'online')
    .map((n) => {
      const available = n.gpus
        .slice(n.gpus_reserved_for_system)
        .map((g) => g.vram_mb)
        .sort((a, b) => a - b);
      if (available.length < gpusNeeded) return 0;
      return available[gpusNeeded - 1];
    });
  return Math.max(0, ...perNodeVrams);
}

function isQuantizedModel(deployment: DeploymentConfig): boolean {
  if (deployment.source.type !== 'huggingface') return false;
  const repo = deployment.source.repo_id.toLowerCase();
  return ['awq', 'gptq', 'fp8', 'marlin', 'quant', 'gguf', 'bnb'].some((tag) =>
    repo.includes(tag),
  );
}

function gpuUtilization(deployment: DeploymentConfig): number {
  const raw = deployment.parallelism.gpu_utilization;
  if (typeof raw === 'number' && raw > 0 && raw <= 1) return raw;
  return DEFAULT_GPU_UTILIZATION;
}

function gpuKey(nodeId: string, gpuIndex: number): string {
  return `${nodeId}:${gpuIndex}`;
}

function isDeploymentEnabled(dep: DeploymentConfig): boolean {
  return dep.enabled === true;
}

function mergeEnabledDeployments(
  config: ApplianceConfig,
  deployment: DeploymentConfig,
): DeploymentConfig[] {
  const merged = new Map<string, DeploymentConfig>();
  for (const item of config.deployments) {
    if (!isDeploymentEnabled(item) || item.id === deployment.id) continue;
    merged.set(item.id, item);
  }
  if (isDeploymentEnabled(deployment)) {
    merged.set(deployment.id, deployment);
  }
  return [...merged.values()];
}

function validateCrossDeploymentGpuBudget(
  deployments: DeploymentConfig[],
  config: ApplianceConfig,
  orchestration: OrchestrationConfig | undefined,
  errors: string[],
  warnings: string[],
): void {
  const enabledDeployments = deployments.filter(isDeploymentEnabled);
  if (enabledDeployments.length <= 1) return;

  const inventory = buildInventory(config);
  const cluster = orchestration ?? config.cluster;
  const budget = new Map<string, number>();
  const contributors = new Map<string, string[]>();
  let totalPeakGpus = 0;

  for (const dep of enabledDeployments) {
    const util = gpuUtilization(dep);
    const instances = effectiveInstances(dep, inventory);
    totalPeakGpus += peakGpuDemand(dep, inventory);

    const targets = dep.placement?.targets ?? [];
    if (!deploymentUsesManualPlacement(dep, cluster) || targets.length === 0) continue;

    for (let i = 0; i < Math.min(instances, targets.length); i += 1) {
      const target = targets[i];
      for (const gpuIndex of target.gpu_indices) {
        const key = gpuKey(target.node_id, gpuIndex);
        budget.set(key, (budget.get(key) ?? 0) + util);
        const names = contributors.get(key) ?? [];
        const label = dep.display_name || dep.id;
        if (!names.includes(label)) {
          contributors.set(key, [...names, label]);
        }
      }
    }
  }

  for (const [key, used] of budget) {
    if (used > 1.0001) {
      const [nodeId, gpuIndex] = key.split(':');
      const node = config.nodes.find((item) => item.id === nodeId);
      const label = node ? `${node.hostname} GPU ${gpuIndex}` : `GPU ${gpuIndex} on ${nodeId}`;
      const models = contributors.get(key)?.join(', ') ?? 'enabled models';
      errors.push(
        `Combined GPU memory utilization on ${label} exceeds 100% (${Math.round(used * 100)}%) ` +
          `across ${models}. Lower gpu utilization, reduce instances on the same GPU, or choose different GPUs.`,
      );
    } else if (used > 0.9) {
      warnings.push(
        `GPU ${key} is nearly full across enabled deployments (${Math.round(used * 100)}% utilization budget).`,
      );
    }
  }

  const distributedFederation =
    config.cluster.serving_mode === 'distributed' &&
    resolveComputeBackend(orchestration ?? config.cluster) === 'federation';

  const clusterBackend =
    config.cluster.serving_mode === 'distributed' &&
    resolveComputeBackend(orchestration ?? config.cluster) === 'cluster';

  if (clusterBackend || !distributedFederation) {
    if (totalPeakGpus > inventory.available_gpu_count) {
      errors.push(
        `Enabled deployments need up to ${totalPeakGpus} GPU(s) at peak but only ${inventory.available_gpu_count} are available.`,
      );
    }
  }
}

export function validateDeployment(
  deployment: DeploymentConfig,
  config: ApplianceConfig,
  orchestration?: OrchestrationConfig,
): ValidationResult {
  const inventory = buildInventory(config);
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggested = deriveRecommendation(deployment, config);

  const instances = effectiveInstances(deployment, inventory);
  const { gpus_per_instance, nodes_per_instance } = deployment.parallelism;
  const gpusRequired = peakGpuDemand(deployment, inventory);
  const standalone = config.cluster.serving_mode === 'standalone';

  if (!inventory.head_online) {
    errors.push('Head node must be online to run deployments.');
  }

  if (gpusRequired > inventory.available_gpu_count) {
    errors.push(
      `This deployment needs ${gpusRequired} GPUs but only ${inventory.available_gpu_count} are available.`,
    );
  }

  const util = gpuUtilization(deployment);
  if (util <= 0 || util > 1) {
    errors.push('GPU utilization must be between 0 and 1 (e.g. 0.85).');
  }

  if (standalone) {
    if (nodes_per_instance > 1) {
      errors.push('Standalone mode supports only one node per instance (set nodes per instance to 1).');
    }
    if (gpus_per_instance > inventory.max_gpus_per_node) {
      errors.push(
        `Each instance needs ${gpus_per_instance} GPUs but the largest node has ${inventory.max_gpus_per_node} available.`,
      );
    }
  } else {
    if (nodes_per_instance > inventory.online_node_count) {
      errors.push(
        `Each instance spans ${nodes_per_instance} nodes but only ${inventory.online_node_count} are online.`,
      );
    }
  }

  const autoscale = deployment.parallelism.autoscaling;
  if (autoscale) {
    if (autoscale.min_instances > autoscale.max_instances) {
      errors.push('Autoscale minimum instances cannot exceed maximum.');
    }
    const maxGpus = autoscale.max_instances * gpus_per_instance * nodes_per_instance;
    if (maxGpus > inventory.available_gpu_count) {
      warnings.push(
        `Autoscale may request up to ${maxGpus} GPUs at peak; only ${inventory.available_gpu_count} are available.`,
      );
    }
  }

  const vramEstimate = estimateModelVramMb(deployment);
  const vramPerGpu = Math.ceil(vramEstimate / Math.max(1, gpus_per_instance));
  const minVram = minVramOnNode(config, gpus_per_instance);
  if (minVram > 0 && vramPerGpu > minVram && !isQuantizedModel(deployment)) {
    warnings.push(
      `Estimated model size (~${Math.round(vramEstimate / 1024)} GB) may not fit in ${gpus_per_instance} GPU(s) with ${Math.round(minVram / 1024)} GB each.`,
    );
  }

  const formMode = resolveDeploymentFormMode(orchestration ?? config.cluster, deployment);
  if (formMode.placementRequired) {
    const targets = deployment.placement?.targets ?? [];
    if (targets.length !== instances) {
      errors.push(
        `Select placement for all ${instances} instance(s): node and GPU target per instance.`,
      );
    }
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      const node = config.nodes.find((item) => item.id === target.node_id);
      if (!node) {
        errors.push(`Instance ${i + 1}: unknown node ${target.node_id}.`);
        continue;
      }
      if (target.gpu_indices.length !== gpus_per_instance) {
        errors.push(
          `Instance ${i + 1} on ${node.hostname}: select exactly ${gpus_per_instance} GPU(s).`,
        );
      }
      const allowed = new Set(availableGpus(node));
      for (const gpuIndex of target.gpu_indices) {
        if (!allowed.has(gpuIndex)) {
          errors.push(
            `Instance ${i + 1} on ${node.hostname}: GPU ${gpuIndex} is unavailable or reserved.`,
          );
        }
      }
    }
  }

  if (deployment.source.type === 'local_path' && !deployment.source.path.startsWith('/')) {
    errors.push('Local model path must be an absolute path.');
  }

  if (!deployment.display_name.trim()) {
    errors.push('Display name is required.');
  }

  const clusterBackend =
    !standalone && resolveComputeBackend(orchestration ?? config.cluster) === 'cluster';
  if (clusterBackend && nodes_per_instance > 1 && instances > 1) {
    warnings.push(
      'Large-model pipeline parallelism with multiple replicas may require substantial cluster GPU capacity.',
    );
  }

  validateCrossDeploymentGpuBudget(
    mergeEnabledDeployments(config, deployment),
    config,
    orchestration,
    errors,
    warnings,
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggested,
    inventory,
  };
}