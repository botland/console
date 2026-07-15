import { afterEach, describe, expect, it, vi } from 'vitest';

import { getConsoleUiPath, nodeConsoleUrl } from '@/lib/node-console';

describe('nodeConsoleUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to /console path on appliance hosts', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    expect(getConsoleUiPath()).toBe('/console');
    expect(nodeConsoleUrl('10.0.0.2')).toBe('http://10.0.0.2/console');
    expect(nodeConsoleUrl('')).toBe('/console');
  });

  it('uses Next basePath when set (e.g. demo)', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/demo');
    expect(getConsoleUiPath()).toBe('/demo');
    expect(nodeConsoleUrl('10.0.0.2')).toBe('http://10.0.0.2/demo');
  });

  it('appends UI path to bare http origins', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/console');
    expect(nodeConsoleUrl('http://10.0.0.2')).toBe('http://10.0.0.2/console');
    expect(nodeConsoleUrl('http://10.0.0.2/')).toBe('http://10.0.0.2/console');
  });

  it('maps /api URLs to the UI path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/console');
    expect(nodeConsoleUrl('http://10.0.0.2/api')).toBe('http://10.0.0.2/console');
  });

  it('does not double-append the UI path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/console');
    expect(nodeConsoleUrl('http://10.0.0.2/console')).toBe('http://10.0.0.2/console');
  });
});
