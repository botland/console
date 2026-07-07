import { describe, expect, it } from 'vitest';

import {
  effectiveApplianceState,
  hasDegradedSignals,
  isStaleRuntimeWarning,
} from '@/lib/appliance-status';
import type { ApplianceConfig, ApplianceStatus } from '@/lib/types';

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

  it('ignores stale runtime warnings for disabled models', () => {
    const config = {
      deployments: [
        {
          id: 'dep-new',
          display_name: 'TheBloke/deepseek-coder-6.7B-instruct-GPTQ',
          enabled: true,
          source: { type: 'huggingface', repo_id: 'TheBloke/deepseek-coder-6.7B-instruct-GPTQ' },
          status: 'reconciling',
        },
        {
          id: 'dep-old',
          display_name: 'casperhansen/llama-3-8b-instruct-awq',
          enabled: false,
          source: { type: 'huggingface', repo_id: 'casperhansen/llama-3-8b-instruct-awq' },
          status: 'stopped',
        },
      ],
    } as ApplianceConfig;

    const status: ApplianceStatus = {
      ...baseStatus(),
      state: 'DEGRADED',
      actual: {
        current_model: 'casperhansen/llama-3-8b-instruct-awq',
        log_snippet: 'GPU VRAM likely insufficient for casperhansen/llama-3-8b-instruct-awq',
      },
    };

    expect(isStaleRuntimeWarning(status, config)).toBe(true);
    expect(hasDegradedSignals(status, config)).toBe(false);
    expect(effectiveApplianceState(status, config)).toBe('RECONCILING');
  });
});