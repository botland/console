import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, vi } from 'vitest';

const testDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appliance-console-test-'));
process.env.APPLIANCE_CONSOLE_DATA_DIR = testDataRoot;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});