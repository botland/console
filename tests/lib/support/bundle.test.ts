import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDiagnosticBundle } from '@/lib/support/bundle';
import { resetTestState } from '@/lib/runtime';

describe('buildDiagnosticBundle', () => {
  beforeEach(() => {
    resetTestState();
    vi.stubEnv('SUPPORT_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes mock diagnostics attachments', async () => {
    const bundle = await buildDiagnosticBundle('Head migration failed');
    expect(bundle.appliance_id).toBeTruthy();
    expect(bundle.user_note).toBe('Head migration failed');
    expect(bundle.software.controller_version).toBe('mock');
    expect(bundle.attachments?.host).toBeTruthy();
    expect(bundle.attachments?.container_logs_tail).toBeTruthy();
  });
});