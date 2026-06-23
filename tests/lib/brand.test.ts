import { afterEach, describe, expect, it, vi } from 'vitest';

describe('brand', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses defaults when env is unset', async () => {
    const brand = await import('@/lib/brand');
    expect(brand.BRAND_NAME).toBe('OwnEdge');
    expect(brand.BRAND_TLD).toBe('.ai');
    expect(brand.BRAND_SLUG).toBe('ownedge');
    expect(brand.BRAND_DOMAIN).toBe('ownedge.ai');
    expect(brand.BRAND_DISPLAY).toBe('OwnEdge.ai');
  });

  it('uses custom env values', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRAND_NAME', 'Acme');
    vi.stubEnv('NEXT_PUBLIC_BRAND_TLD', '.io');
    vi.stubEnv('NEXT_PUBLIC_BRAND_DOMAIN', 'console.acme.io');
    const brand = await import('@/lib/brand');
    expect(brand.BRAND_NAME).toBe('Acme');
    expect(brand.BRAND_DOMAIN).toBe('console.acme.io');
    expect(brand.BRAND_DISPLAY).toBe('Acme.io');
  });
});