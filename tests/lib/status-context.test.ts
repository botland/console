import { describe, expect, it } from 'vitest';

import { STATUS_POLL_INTERVAL_MS, STATUS_WS_PATH } from '@/lib/status-context';

describe('status-context constants', () => {
  it('poll interval matches overview cadence', () => {
    expect(STATUS_POLL_INTERVAL_MS).toBe(5_000);
  });

  it('websocket path matches v1 status stream', () => {
    expect(STATUS_WS_PATH).toBe('/api/v1/ws');
  });
});