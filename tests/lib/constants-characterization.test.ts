import { describe, expect, it } from 'vitest';

import { v1Config } from '@/tests/helpers/fixtures';
import { loadContract } from '../helpers/contracts';
import { migrateConfigV1ToV2, parseApplianceConfig } from '@/lib/schema';

describe('constants characterization', () => {
  it('appliance states align with shared contract', () => {
    const contract = loadContract<{ console_states: string[] }>('appliance-states.json');
    for (const state of contract.console_states) {
      expect(['BOOT', 'READY', 'DEGRADED', 'FAILED', 'RECONCILING']).toContain(state);
    }
  });

  it('legacy litellm_standalone migrates to standalone serving mode', () => {
    const migrated = migrateConfigV1ToV2({
      ...v1Config,
      cluster: { ...v1Config.cluster, serving_mode: 'litellm_standalone' },
    });
    expect(migrated.cluster.serving_mode).toBe('standalone');
  });

  it('v2 migration defaults include context 8192 under parallelism', () => {
    const migrated = migrateConfigV1ToV2({
      version: 1,
      cluster: { serving_mode: 'litellm_standalone', head_node_id: 'node-1', head_epoch: 1 },
      system: { network: { head_ip: '10.0.0.1' } },
      nodes: [{ id: 'node-1', hostname: 'h1', ip: '10.0.0.1' }],
      deployments: [
        {
          id: 'd1',
          display_name: 'm',
          enabled: true,
          source: { type: 'huggingface', repo_id: 'org/m' },
          user_intent: { performance_goal: 'balanced', scale: 'small' },
        },
      ],
    });
    expect(migrated.deployments[0]?.parallelism.context_length).toBe(8192);
  });
});