export type RuntimeMode = 'mock' | 'inferedge';

export function getRuntimeMode(): RuntimeMode {
  return process.env.APPLIANCE_RUNTIME === 'inferedge' ? 'inferedge' : 'mock';
}

export function isInferedgeRuntime(): boolean {
  return getRuntimeMode() === 'inferedge';
}