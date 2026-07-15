import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getHeadApiBase as gatewayHeadBase, getGatewayInfo } from '@/lib/mock/gateway';
import { getGatewayStatus } from '@/lib/mock/store';
import { resetStore } from '@/tests/helpers/store';

describe('head URL characterization (REFACTO §1.3)', () => {
  beforeEach(() => {
    resetStore();
    delete process.env.APPLIANCE_HEAD_INTERNAL_URL;
    delete process.env.APPLIANCE_PORT;
    delete process.env.APPLIANCE_CONSOLE_PORT;
    delete process.env.HEAD_CONSOLE_URL;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.CONSOLE_BASE_PATH;
  });

  afterEach(() => {
    delete process.env.APPLIANCE_HEAD_INTERNAL_URL;
    delete process.env.APPLIANCE_PORT;
    delete process.env.APPLIANCE_CONSOLE_PORT;
    delete process.env.HEAD_CONSOLE_URL;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    delete process.env.CONSOLE_BASE_PATH;
  });

  it('documents default port divergence between mock store and runtime gateway', async () => {
    const fromStore = getGatewayStatus();
    const fromGateway = await getGatewayInfo();
    expect(fromStore.head_api_url).toBe('http://192.168.1.10:3000/console/api');
    expect(fromGateway.head_api_url).toBe('http://192.168.1.10/console/api');
    expect(fromStore.head_api_url).not.toBe(fromGateway.head_api_url);
  });

  it('store and gateway agree when APPLIANCE_CONSOLE_PORT is set', async () => {
    process.env.APPLIANCE_CONSOLE_PORT = '3000';
    process.env.APPLIANCE_PORT = '3000';
    const fromStore = getGatewayStatus();
    const fromGateway = await getGatewayInfo();
    expect(fromStore.head_api_url).toBe(fromGateway.head_api_url);
    expect(fromStore.head_api_url).toBe('http://192.168.1.10:3000/console/api');
  });

  it('both honor APPLIANCE_HEAD_INTERNAL_URL override', async () => {
    process.env.APPLIANCE_HEAD_INTERNAL_URL = 'http://head-internal:4000';
    expect(getGatewayStatus().head_api_url).toBe('http://head-internal:4000/console/api');
    expect((await getGatewayInfo()).head_api_url).toBe('http://head-internal:4000/console/api');
    expect(await gatewayHeadBase()).toBe('http://head-internal:4000');
  });

  it('default port is 3000 when APPLIANCE_PORT is unset (mock store)', () => {
    expect(getGatewayStatus().head_api_url).toContain(':3000/');
    expect(getGatewayStatus().head_api_url).toContain('/console/api');
  });
});
