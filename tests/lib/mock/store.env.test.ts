import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('store data dir fallback', () => {
  const previous = process.env.APPLIANCE_CONSOLE_DATA_DIR;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.APPLIANCE_CONSOLE_DATA_DIR;
    } else {
      process.env.APPLIANCE_CONSOLE_DATA_DIR = previous;
    }
    vi.resetModules();
  });

  it('uses .data under cwd when env is unset', async () => {
    delete process.env.APPLIANCE_CONSOLE_DATA_DIR;
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'appliance-console-cwd-'));
    const previousCwd = process.cwd();
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);

    const { resetTestState, getState } = await import('@/lib/mock/store');
    resetTestState({ seed: true, persist: true });
    expect(fs.existsSync(path.join(cwd, '.data', 'state.json'))).toBe(true);
    expect(getState().config.nodes.length).toBeGreaterThan(0);

    vi.mocked(process.cwd).mockRestore();
    process.chdir(previousCwd);
  });
});