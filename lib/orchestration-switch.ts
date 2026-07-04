import type { ClusterConfig, ComputeBackend, FederationLayout, ServingMode } from '@/lib/types';

export type OrchestrationSwitchKind =
  | 'serving_mode'
  | 'compute_backend'
  | 'federation_layout'
  | 'head_gpu';

const servingLabels: Record<ServingMode, string> = {
  distributed: 'Distributed',
  standalone: 'Standalone',
};

const backendLabels: Record<ComputeBackend, string> = {
  federation: 'Federated inference',
  cluster: 'Clustered inference',
};

const layoutLabels: Record<FederationLayout, string> = {
  replicated: 'Replicated (throughput)',
  diverse: 'Diverse (multi-model)',
};

export function labelServingMode(mode: ServingMode): string {
  return servingLabels[mode];
}

export function labelComputeBackend(backend: ComputeBackend): string {
  return backendLabels[backend];
}

export function labelFederationLayout(layout: FederationLayout): string {
  return layoutLabels[layout];
}

export function describeOrchestrationSwitch(
  kind: OrchestrationSwitchKind,
  from: string,
  to: string,
  deploymentCount: number,
): { title: string; message: string; progress: string } {
  const depNote =
    deploymentCount > 0
      ? `${deploymentCount} active deployment(s) will stop and reschedule.`
      : 'Active deployments will reschedule.';

  switch (kind) {
    case 'serving_mode':
      return {
        title: 'Change serving topology?',
        message: `Switch from ${labelServingMode(from as ServingMode)} to ${labelServingMode(to as ServingMode)}. Running inference will restart. ${depNote}`,
        progress: `Switching to ${labelServingMode(to as ServingMode)}…`,
      };
    case 'compute_backend':
      return {
        title: 'Change inference backend?',
        message: `Switch from ${labelComputeBackend(from as ComputeBackend)} to ${labelComputeBackend(to as ComputeBackend)}. Containers and routing will be torn down and rebuilt. ${depNote}`,
        progress: `Switching to ${labelComputeBackend(to as ComputeBackend)}…`,
      };
    case 'federation_layout':
      return {
        title: 'Change federation layout?',
        message: `Switch from ${labelFederationLayout(from as FederationLayout)} to ${labelFederationLayout(to as FederationLayout)}. Instance placement will be replanned. ${depNote}`,
        progress: `Switching to ${labelFederationLayout(to as FederationLayout)}…`,
      };
    case 'head_gpu':
      return {
        title: to === 'true' ? 'Enable head GPU inference?' : 'Disable head GPU inference?',
        message:
          to === 'true'
            ? `The coordinator will run model workloads on its GPU. ${depNote}`
            : `The coordinator will stop serving models locally; workers must carry inference. ${depNote}`,
        progress:
          to === 'true'
            ? 'Enabling coordinator inference…'
            : 'Disabling coordinator inference…',
      };
  }
}

const DISRUPTION_STATES = new Set(['RECONCILING', 'BOOT', 'DEGRADED']);
const SETTLED_STATES = new Set(['READY', 'DEGRADED']);

function isSettledState(state: string): boolean {
  return SETTLED_STATES.has(state);
}

function isDisruptionState(state: string): boolean {
  return DISRUPTION_STATES.has(state);
}

/** Wait until a disruptive orchestration change finishes reconciling. */
export async function waitForOrchestrationSettle(
  poll: () => Promise<{ state: string }>,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ state: string; settled: boolean }> {
  // Ray cluster switches can exceed 2 minutes (image pull + Serve deploy).
  const timeoutMs = options?.timeoutMs ?? 300_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  let latest = await poll();
  let sawDisruption = isDisruptionState(latest.state);

  while (Date.now() < deadline) {
    if (isDisruptionState(latest.state)) {
      sawDisruption = true;
    }
    if (sawDisruption && isSettledState(latest.state)) {
      return { state: latest.state, settled: true };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latest = await poll();
  }

  if (isSettledState(latest.state)) {
    return { state: latest.state, settled: true };
  }
  return { state: latest.state, settled: false };
}