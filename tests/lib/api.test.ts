import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ApplianceConfig,
  ClusterConfig,
  DeploymentConfig,
  SystemConfig,
} from '@/lib/types';
import { api } from '@/lib/api';

function mockFetch<T>(data: T, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      statusText: 'Error',
      json: async () => data,
    }),
  );
}

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches status and config', async () => {
    const status = { state: 'READY', config: { version: 2 } };
    mockFetch(status);
    await expect(api.status()).resolves.toEqual(status);
    expect(fetch).toHaveBeenCalledWith('/api/status', undefined);

    mockFetch({ version: 2 });
    await expect(api.getConfig()).resolves.toEqual({ version: 2 });
  });

  it('updates config and exports', async () => {
    const config = { version: 2 } as ApplianceConfig;
    mockFetch(config);
    await expect(api.putConfig(config)).resolves.toEqual(config);

    const open = vi.fn();
    vi.stubGlobal('window', { open });
    api.exportConfig();
    expect(open).toHaveBeenCalledWith('/api/config/export', '_blank');
  });

  it('imports config', async () => {
    mockFetch({ applied: true });
    await api.importConfig({ version: 2 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/import',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('manages deployments', async () => {
    const dep = { id: 'dep-1' } as DeploymentConfig;
    mockFetch([dep]);
    await expect(api.listDeployments()).resolves.toEqual([dep]);

    mockFetch(dep);
    await expect(api.createDeployment(dep)).resolves.toEqual(dep);

    mockFetch(dep);
    await expect(api.updateDeployment('dep-1', dep)).resolves.toEqual(dep);

    mockFetch({ deleted: true });
    await expect(api.deleteDeployment('dep-1')).resolves.toEqual({ deleted: true });

    mockFetch({ instances: 2, gpus_per_instance: 1, nodes_per_instance: 1, context_length: 8192, warnings: [] });
    await expect(api.recommend(dep)).resolves.toMatchObject({ instances: 2 });

    mockFetch({ valid: true, errors: [], warnings: [] });
    await expect(api.validate(dep)).resolves.toMatchObject({ valid: true });
  });

  it('manages cluster and head migration', async () => {
    const cluster = { head_node_id: 'node-1' } as ClusterConfig;
    mockFetch(cluster);
    await expect(api.getCluster()).resolves.toEqual(cluster);

    mockFetch(cluster);
    await expect(api.putCluster(cluster)).resolves.toEqual(cluster);

    mockFetch({ success: true });
    await expect(api.migrateHead('node-2')).resolves.toMatchObject({ success: true });
  });

  it('manages nodes and system', async () => {
    mockFetch([{ id: 'node-1' }]);
    await expect(api.listNodes()).resolves.toEqual([{ id: 'node-1' }]);

    mockFetch({ id: 'node-1', labels: ['a'] });
    await expect(api.updateNode('node-1', { labels: ['a'] })).resolves.toMatchObject({
      labels: ['a'],
    });

    const system = { security: { api_token_set: true } } as SystemConfig;
    mockFetch(system);
    await expect(api.getSystem()).resolves.toEqual(system);

    mockFetch(system);
    await expect(api.putSystem(system)).resolves.toEqual(system);
  });

  it('manages storage', async () => {
    mockFetch({ total_bytes: 1, used_bytes: 1, paths: {}, mounts: [] });
    await expect(api.getStorage()).resolves.toMatchObject({ total_bytes: 1 });

    mockFetch({ id: 'mount-1', type: 'nfs', remote: 'x', local_path: '/mnt' });
    await expect(
      api.addMount({ type: 'nfs', remote: 'x', local_path: '/mnt' }),
    ).resolves.toMatchObject({ id: 'mount-1' });

    mockFetch({ deleted: true });
    await expect(api.deleteMount('mount-1')).resolves.toEqual({ deleted: true });
  });

  it('throws on failed requests with server error body', async () => {
    mockFetch({ error: 'Invalid config' }, false);
    await expect(api.getConfig()).rejects.toThrow('Invalid config');
  });

  it('falls back to status text when error JSON has no error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({}),
      }),
    );
    await expect(api.getConfig()).rejects.toThrow('Forbidden');
  });

  it('falls back to status text when error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
        json: async () => {
          throw new Error('not json');
        },
      }),
    );
    await expect(api.listNodes()).rejects.toThrow('Server Error');
  });
});