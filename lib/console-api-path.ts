/**
 * Management API path under the console basePath.
 * OpenWebUI owns host `/api/*`; the appliance console lives at `/console/api/*`.
 */
export function getConsoleApiPath(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_PATH ??
    process.env.CONSOLE_BASE_PATH ??
    process.env.CONSOLE_UI_PATH ??
    '/console';
  const base = !raw || raw === '/' ? '/console' : raw.startsWith('/') ? raw : `/${raw}`;
  const ui = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${ui}/api`;
}

/** Ensure a URL is a full management API base ending in `/api` (possibly `/console/api`). */
export function toManagementApiBase(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith(getConsoleApiPath()) || trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}${getConsoleApiPath()}`;
}
