export class ControllerError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Controller request failed (${status}): ${body}`);
    this.name = 'ControllerError';
  }
}

export function getControllerBaseUrl(): string {
  return (process.env.APPLIANCE_CONTROLLER_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
}

export function getControllerToken(): string {
  return process.env.APPLIANCE_CONTROLLER_TOKEN ?? process.env.CONTROLLER_API_TOKEN ?? '';
}

export function controllerUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getControllerBaseUrl()}${normalized}`;
}

export async function controllerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getControllerToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(controllerUrl(path), {
    ...init,
    headers,
  });
}

export async function controllerJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await controllerFetch(path, init);
  if (!response.ok) {
    const body = await response.text();
    throw new ControllerError(response.status, body);
  }
  return response.json() as Promise<T>;
}