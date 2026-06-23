import { deriveRecommendation } from '@/lib/planner';
import type { ApplianceConfig, DeploymentConfig, ValidationResult } from '@/lib/types';

import { buildInventory } from './inventory';

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

export function validateDeployment(
  deployment: DeploymentConfig,
  config: ApplianceConfig,
): ValidationResult {
  const inventory = buildInventory(config);
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggested = deriveRecommendation(deployment, config);

  const { instances, gpus_per_instance, nodes_per_instance } = deployment.parallelism;
  const gpusRequired = instances * gpus_per_instance * nodes_per_instance;
  const standalone = config.cluster.serving_mode === 'standalone';

  if (!inventory.head_online) {
    errors.push('Head node must be online to run deployments.');
  }

  if (gpusRequired > inventory.available_gpu_count) {
    errors.push(
      `This deployment needs ${gpusRequired} GPUs but only ${inventory.available_gpu_count} are available.`,
    );
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
  if (minVram > 0 && vramPerGpu > minVram) {
    warnings.push(
      `Estimated model size (~${Math.round(vramEstimate / 1024)} GB) may not fit in ${gpus_per_instance} GPU(s) with ${Math.round(minVram / 1024)} GB each.`,
    );
  }

  if (deployment.source.type === 'local_path' && !deployment.source.path.startsWith('/')) {
    errors.push('Local model path must be an absolute path.');
  }

  if (!deployment.display_name.trim()) {
    errors.push('Display name is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggested,
    inventory,
  };
}