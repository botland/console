import type { ApplianceConfig, ApplianceState, ApplianceStatus, DeploymentConfig } from '@/lib/types';

function deploymentModelRef(deployment: DeploymentConfig): string | null {
  if (deployment.source.type === 'huggingface') return deployment.source.repo_id;
  if (deployment.source.type === 'local_path') return deployment.source.path;
  return null;
}

function matchesEnabledDeployment(currentModel: string, config: ApplianceConfig): boolean {
  return config.deployments.some((deployment) => {
    if (!deployment.enabled) return false;
    const ref = deploymentModelRef(deployment);
    return ref === currentModel || deployment.display_name === currentModel;
  });
}

/** True when /status still reports a failure for a model that is no longer enabled. */
export function isStaleRuntimeWarning(
  status: ApplianceStatus,
  config?: ApplianceConfig | null,
): boolean {
  const currentModel = status.actual?.current_model?.trim();
  if (!config || !currentModel) return false;
  const hasEnabled = config.deployments.some((deployment) => deployment.enabled);
  if (!hasEnabled) return false;
  return !matchesEnabledDeployment(currentModel, config);
}

export function hasDegradedSignals(
  status: ApplianceStatus,
  config?: ApplianceConfig | null,
): boolean {
  if (isStaleRuntimeWarning(status, config)) return false;
  const actual = status.actual;
  if (!actual) return false;
  return (
    (actual.exit_code != null && actual.exit_code !== 0) ||
    Boolean(actual.log_snippet?.trim())
  );
}

/** Map controller READY + stale runtime failures to a degraded display state. */
export function effectiveApplianceState(
  status: ApplianceStatus,
  config?: ApplianceConfig | null,
): ApplianceState {
  if (isStaleRuntimeWarning(status, config)) {
    const reconciling = config?.deployments.some(
      (deployment) => deployment.enabled && deployment.status === 'reconciling',
    );
    if (reconciling || status.state === 'DEGRADED') {
      return 'RECONCILING';
    }
  }
  if (status.state === 'READY' && hasDegradedSignals(status, config)) {
    return 'DEGRADED';
  }
  return status.state;
}