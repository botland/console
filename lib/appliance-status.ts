import type { ApplianceState, ApplianceStatus } from '@/lib/types';

export function hasDegradedSignals(status: ApplianceStatus): boolean {
  const actual = status.actual;
  if (!actual) return false;
  return (
    (actual.exit_code != null && actual.exit_code !== 0) ||
    Boolean(actual.log_snippet?.trim())
  );
}

/** Map controller READY + stale runtime failures to a degraded display state. */
export function effectiveApplianceState(status: ApplianceStatus): ApplianceState {
  if (status.state === 'READY' && hasDegradedSignals(status)) {
    return 'DEGRADED';
  }
  return status.state;
}