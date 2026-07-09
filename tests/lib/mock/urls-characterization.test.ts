import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getHeadApiBase as gatewayHeadBase, getGatewayInfo } from '@/lib/mock/gateway';
import { getGatewayStatus } from '@/lib/mock/store';
import { resetStore } from '@/tests/helpers/store';

describe('head URL characterization (REFACTO §1.3)', () => {
  beforeEach(() => {
    resetStore();
    delete process.env.APPLIANCE_HEAD_INTERNAL_URL;
    delete process.env.APPLIANCE_PORT;
  });

  afterEach(() => {
    delete process.env.APPLIANCE_HEAD_INTERNAL_URL;
    delete process.env.APPLIANCE_PORT;
  });

  it('store and gateway agree on default head URL', () => {
    const fromStore = getGatewayStatus();
    const fromGateway = getGatewayInfo();
    expect(fromStore.head_api_url).toBe(fromGateway.head_api_url);
    expect(fromStore.head_api_url).toBe('http://192.168.1.10:3000/api');
  });

  it('both honor APPLIANCE_HEAD_INTERNAL_URL override', () => {
    process.env.APPLIANCE_HEAD_INTERNAL_URL = 'http://head-internal:4000';
    expect(getGatewayStatus().head_api_url).toBe('http://head-internal:4000/api');
    expect(getGatewayInfo().head_api_url).toBe('http://head-internal:4000/api');
    expect(gatewayHeadBase()).toBe('http://head-internal:4000');
  });

  it('default port is 3000 when APPLIANCE_PORT is unset', () => {
    expect(getGatewayStatus().head_api_url).toContain(':3000/');
  });
});