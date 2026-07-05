import { describe, expect, it } from 'vitest';

import { minimalConfig } from '@/tests/helpers/fixtures';
import { validateNodeAddresses } from '@/lib/validation/nodes';

describe('validateNodeAddresses', () => {
  it('accepts distinct node addresses', () => {
    const config = minimalConfig();
    expect(validateNodeAddresses(config.nodes)).toBeNull();
  });

  it('rejects duplicate IPs', () => {
    const config = minimalConfig({
      nodes: [
        {
          id: 'node-1',
          hostname: 'head',
          ip: '10.0.0.1',
          is_head: true,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [],
        },
        {
          id: 'node-2',
          hostname: 'worker',
          ip: '10.0.0.1',
          is_head: false,
          gpus_reserved_for_system: 0,
          labels: [],
          status: 'online',
          gpus: [],
        },
      ],
    });
    expect(validateNodeAddresses(config.nodes)).toMatch(/Duplicate node IP/);
  });
});