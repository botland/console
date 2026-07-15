/**
 * Public path for the management console UI.
 * Appliances serve OpenWebUI at `/` and the console at `/console` (Next.js basePath).
 * Marketing demos may use `/demo` via CONSOLE_BASE_PATH / NEXT_PUBLIC_BASE_PATH.
 */
export function getConsoleUiPath(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_PATH ??
    process.env.CONSOLE_BASE_PATH ??
    process.env.CONSOLE_UI_PATH ??
    '/console';
  if (!raw || raw === '/') return '/console';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

/** Browser URL for another appliance's management console. */
export function nodeConsoleUrl(ip: string): string {
  const uiPath = getConsoleUiPath();
  const trimmed = ip.trim();
  if (!trimmed) return uiPath;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const base = trimmed.replace(/\/$/, '');
    if (base.endsWith(uiPath)) return base;
    // Already points at API — use origin + UI path
    try {
      const u = new URL(base);
      if (u.pathname === '/api' || u.pathname.endsWith('/api')) {
        return `${u.origin}${uiPath}`;
      }
      if (u.pathname && u.pathname !== '/') {
        return base;
      }
      return `${u.origin}${uiPath}`;
    } catch {
      return base;
    }
  }

  return `http://${trimmed}${uiPath}`;
}
