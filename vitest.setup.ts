import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, vi } from 'vitest';

const testDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appliance-console-test-'));
process.env.APPLIANCE_CONSOLE_DATA_DIR = testDataRoot;
process.env.APPLIANCE_DISABLE_AGENT_SIM = '1';
process.env.APPLIANCE_GATEWAY_INTERNAL = '1';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});