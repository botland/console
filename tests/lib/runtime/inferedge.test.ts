import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as inferedge from '@/lib/runtime/inferedge';

describe('inferedge runtime', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.APPLIANCE_CONTROLLER_URL = 'http://controller:8080';
    process.env.APPLIANCE_CONTROLLER_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.APPLIANCE_CONTROLLER_URL;
    delete process.env.APPLIANCE_CONTROLLER_TOKEN;
  });

  it('fetches cluster config from controller', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          serving_mode: 'distributed',
          head_node_id: 'node-1',
          head_epoch: 2,
          global_defaults: { autoscale_enabled: true },
        }),
        { status: 200 },
      ),
    );

    const cluster = await inferedge.getCluster();
    expect(cluster.head_node_id).toBe('node-1');
    expect(fetch).toHaveBeenCalledWith(
      'http://controller:8080/orchestration',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it('elevates READY to DEGRADED when actual reports load failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'READY',
          last_error: null,
          head: { head_node_id: 'node-1', head_ip: '10.0.0.1', head_epoch: 1 },
          actual: {
            health: 'HEALTHY',
            exit_code: 1,
            log_snippet: 'VRAM insufficient',
          },
        }),
        { status: 200 },
      ),
    );

    const status = await inferedge.getStatus();
    expect(status.state).toBe('DEGRADED');
  });

  it('maps actual runtime warnings from controller status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'READY',
          last_error: null,
          head: { head_node_id: 'node-1', head_ip: '10.0.0.1', head_epoch: 1 },
          actual: {
            health: 'HEALTHY',
            exit_code: 1,
            log_snippet: 'VRAM insufficient for model',
            current_model: 'org/model',
          },
        }),
        { status: 200 },
      ),
    );

    const status = await inferedge.getStatus();
    expect(status.actual).toEqual({
      health: 'HEALTHY',
      exit_code: 1,
      log_snippet: 'VRAM insufficient for model',
      current_model: 'org/model',
    });
  });

  it('maps controller status to console appliance status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'FAILED',
          last_error: 'boom',
          last_reconcile_ts: 123,
          head: { head_node_id: 'node-1', head_ip: '10.0.0.1', head_epoch: 1 },
          events: [
            {
              id: 'evt-1',
              timestamp: '2026-01-01T00:00:00Z',
              message: 'Reconciliation complete',
              level: 'info',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const status = await inferedge.getStatus();
    expect(status.state).toBe('DEGRADED');
    expect(status.last_error).toBe('boom');
    expect(status.events).toHaveLength(1);
  });

  it('loads config from GET /config', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 2,
          appliance_id: 'edge-1',
          cluster: {
            serving_mode: 'standalone',
            head_node_id: 'node-1',
            head_epoch: 1,
            global_defaults: { autoscale_enabled: true },
          },
          nodes: [
            {
              id: 'node-1',
              hostname: 'head',
              ip: '10.0.0.1',
              is_head: true,
              gpus_reserved_for_system: 0,
              labels: [],
              status: 'online',
              gpus: [],
            },
          ],
          deployments: [],
          system: {
            network: { head_ip: '10.0.0.1', gateway: '', dns: [] },
            time: { ntp_servers: [] },
            security: { api_token_set: false },
          },
          storage: { mounts: [] },
        }),
        { status: 200 },
      ),
    );

    const config = await inferedge.getConfig();
    expect(config.appliance_id).toBe('edge-1');
    expect(fetch).toHaveBeenCalledWith('http://controller:8080/config', expect.any(Object));
  });

  it('updates config via PUT /config', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 2,
          appliance_id: 'edge-1',
          cluster: {
            serving_mode: 'standalone',
            head_node_id: 'node-1',
            head_epoch: 1,
            global_defaults: { autoscale_enabled: true },
          },
          nodes: [
            {
              id: 'node-1',
              hostname: 'head',
              ip: '10.0.0.1',
              is_head: true,
              gpus_reserved_for_system: 0,
              labels: [],
              status: 'online',
              gpus: [],
            },
          ],
          deployments: [],
          system: {
            network: { head_ip: '10.0.0.1', gateway: '', dns: [] },
            time: { ntp_servers: [] },
            security: { api_token_set: true },
          },
          storage: { mounts: [] },
        }),
        { status: 200 },
      ),
    );

    const config = await inferedge.setConfig({ version: 2, appliance_id: 'edge-1' });
    expect(config.system.security.api_token_set).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://controller:8080/config',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('normalizes import response to applied', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, head_node_id: 'node-1' }), { status: 200 }),
    );

    const result = await inferedge.importConfig({ version: 2 });
    expect(result).toEqual({ applied: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://controller:8080/config/import',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('creates deployments via POST /deployments', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'dep-1',
          display_name: 'model',
          enabled: true,
          source: { type: 'huggingface', repo_id: 'org/model' },
          user_intent: { performance_goal: 'balanced', scale: 'medium' },
          parallelism: {
            context_length: 8192,
            quantization: null,
            instances: 1,
            gpus_per_instance: 1,
            nodes_per_instance: 1,
            autoscaling: null,
          },
          status: 'reconciling',
        }),
        { status: 200 },
      ),
    );

    const dep = await inferedge.createDeployment({
      id: 'dep-1',
      display_name: 'model',
      enabled: true,
      source: { type: 'huggingface', repo_id: 'org/model' },
      user_intent: { performance_goal: 'balanced', scale: 'medium' },
      parallelism: {
        context_length: 8192,
        quantization: null,
        instances: 1,
        gpus_per_instance: 1,
        nodes_per_instance: 1,
        autoscaling: null,
      },
      status: 'reconciling',
    });
    expect(dep.id).toBe('dep-1');
    expect(fetch).toHaveBeenCalledWith(
      'http://controller:8080/deployments',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads storage usage from GET /storage', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          total_bytes: 1000,
          used_bytes: 400,
          paths: { '/models_cache': [{ name: 'model-a', size_bytes: 100, type: 'dir' }] },
        }),
        { status: 200 },
      ),
    );

    const usage = await inferedge.getStorage();
    expect(usage.total_bytes).toBe(1000);
    expect(fetch).toHaveBeenCalledWith('http://controller:8080/storage', expect.any(Object));
  });

  it('returns migrate-head errors without throwing', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Node not online' }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: 'READY',
            head: { head_node_id: 'node-1', head_ip: '10.0.0.1', head_epoch: 1 },
          }),
          { status: 200 },
        ),
      );

    const result = await inferedge.migrateHead('node-2');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Node not online');
  });
});