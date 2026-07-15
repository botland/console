/**
 * Public path prefix when the console is hosted under a subpath.
 *
 * Real appliances: CONSOLE_BASE_PATH=/console (OpenWebUI owns `/`).
 * Marketing demo: CONSOLE_BASE_PATH=/demo (b2b.ownedge.ai/demo).
 * Also exposed as NEXT_PUBLIC_BASE_PATH via next.config for client fetch().
 *
 * Next.js basePath rewrites <Link> and router automatically, but raw fetch() / EventSource
 * must prefix paths themselves. Always use withBasePath() for absolute app paths.
 *
 * External management API remains at host `/api/*` (Traefik rewrites to `/console/api/*`).
 */
export function getBasePath(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_PATH ??
    process.env.CONSOLE_BASE_PATH ??
    '';
  if (!raw || raw === '/') return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/** Prefix an absolute path (`/api/...`) with the app base path when present. */
export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = getBasePath();
  if (!base) return path;
  return `${base}${path}`;
}
