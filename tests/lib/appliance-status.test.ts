import { describe, expect, it } from 'vitest';

import { effectiveApplianceState, hasDegradedSignals } from '@/lib/appliance-status';
import type { ApplianceStatus } from '@/lib/types';

const baseStatus = (): ApplianceStatus => ({
  state: 'READY',
  last_error: null,
  last_reconcile_ts: 1,
  events: [],
  head: { head_node_id: 'node-1', head_ip: '10.0.0.1', head_epoch: 1 },
});

describe('appliance-status', () => {
  it('detects degraded runtime signals', () => {
    expect(
      hasDegradedSignals({
        ...baseStatus(),
        actual: { exit_code: 1, log_snippet: 'VRAM insufficient' },
      }),
    ).toBe(true);
  });

  it('elevates READY to DEGRADED when runtime failed', () => {
    expect(
      effectiveApplianceState({
        ...baseStatus(),
        actual: { exit_code: 1, log_snippet: 'VRAM insufficient' },
      }),
    ).toBe('DEGRADED');
  });

  it('keeps RECONCILING unchanged', () => {
    expect(
      effectiveApplianceState({
        ...baseStatus(),
        state: 'RECONCILING',
        actual: { exit_code: 1 },
      }),
    ).toBe('RECONCILING');
  });
});