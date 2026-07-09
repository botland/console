import { describe, expect, it } from 'vitest';

import { deriveRecommendation } from '@/lib/planner';
import { minimalConfig, sampleDeployment } from '@/tests/helpers/fixtures';
import { loadContract } from '@/tests/helpers/contracts';

describe('planner defaults contract (REFACTO §2.4)', () => {
  it('uses 8192 context_length default for balanced recommendations', () => {
    const dep = sampleDeployment({
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
    });
    const rec = deriveRecommendation(dep, minimalConfig());
    expect(rec.context_length).toBe(8192);
  });

  it('appliance states contract includes states used by mock status', () => {
    const states = loadContract<{ console_states: string[] }>('appliance-states.json');
    expect(states.console_states).toContain('READY');
    expect(states.console_states).toContain('DEGRADED');
  });
});