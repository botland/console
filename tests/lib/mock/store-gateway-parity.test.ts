import { describe, expect, it } from 'vitest';

import { getGatewayInfo } from '@/lib/mock/gateway';
import { getGatewayStatus, getLocalNodeId, isHeadCoordinator } from '@/lib/mock/store';
import { resetStore } from '@/tests/helpers/store';

describe('store vs gateway gateway helpers', () => {
  it('local node id and head role match between modules', async () => {
    resetStore();
    const gateway = await getGatewayInfo();
    expect(getLocalNodeId()).toBe(gateway.local_node_id);
    expect(isHeadCoordinator()).toBe(gateway.is_head);
    expect(getGatewayStatus().is_head).toBe(gateway.is_head);
  });
});