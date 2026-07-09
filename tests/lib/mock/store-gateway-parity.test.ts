import { describe, expect, it } from 'vitest';

import { getGatewayInfo } from '@/lib/mock/gateway';
import { getGatewayStatus, getLocalNodeId, isHeadCoordinator } from '@/lib/mock/store';
import { resetStore } from '@/tests/helpers/store';

describe('store vs gateway gateway helpers', () => {
  it('local node id and head role match between modules', () => {
    resetStore();
    expect(getLocalNodeId()).toBe(getGatewayInfo().local_node_id);
    expect(isHeadCoordinator()).toBe(getGatewayInfo().is_head);
    expect(getGatewayStatus().is_head).toBe(getGatewayInfo().is_head);
  });
});