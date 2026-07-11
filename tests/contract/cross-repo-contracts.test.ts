import { describe, expect, it } from 'vitest';

import { loadContract } from '../helpers/contracts';

describe('cross-repo contracts', () => {
  it('loads log tail limits', () => {
    const limits = loadContract<{ maxLines: number; maxBytes: number }>('log-tail-limits.json');
    expect(limits.maxLines).toBe(200);
    expect(limits.maxBytes).toBe(65536);
  });

  it('loads appliance states', () => {
    const states = loadContract<{ controller_enum: string[] }>('appliance-states.json');
    expect(states.controller_enum).toContain('READY');
    expect(states.controller_enum).toContain('RECONCILING');
  });

  it('loads diagnostic bundle golden', () => {
    const bundle = loadContract<{ appliance_id: string; bundle_version: number }>(
      'diagnostic-bundle.v1.golden.json',
    );
    expect(bundle.appliance_id).toBe('forge-demo-001');
    expect(bundle.bundle_version).toBe(1);
  });

  it('loads support polling limits', () => {
    const limits = loadContract<{
      diagnosis_timeout_sec: number;
      diagnosis_max_retries: number;
    }>('support-polling-limits.json');
    expect(limits.diagnosis_timeout_sec).toBe(360);
    expect(limits.diagnosis_max_retries).toBe(2);
  });
});