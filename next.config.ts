import type { NextConfig } from 'next';
import path from 'path';

/**
 * Real appliances: leave CONSOLE_BASE_PATH unset → console at `/`.
 * Marketing demo only: CONSOLE_BASE_PATH=/demo (b2b.ownedge.ai/demo).
 * NEXT_PUBLIC_BASE_PATH is inlined for client fetch() — Next does not auto-prefix fetch.
 */
const basePath = process.env.CONSOLE_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: basePath || undefined,
  // Silence monorepo lockfile root inference when nested under nocloud.
  outputFileTracingRoot: path.join(__dirname),
  env: {
    // Always define so client code can read a stable key (empty string on appliances).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async headers() {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'X-Robots-Tag', value: 'noindex' },
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;