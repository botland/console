import fs from 'fs';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { minimalConfig, sampleDeployment, v1Config } from '@/tests/helpers/fixtures';
import { resetStore } from '@/tests/helpers/store';

import {
  addEvent,
  addMount,
  createDeployment,
  deleteDeployment,
  getConfig,
  getDeployment,
  getLocalNodeId,
  getState,
  getStatus,
  getStorage,
  isHeadGateway,
  listDeployments,
  migrateHead,
  removeMount,
  resetTestState,
  saveState,
  setConfig,
  startReconcile,
  subscribeWs,
  updateCluster,
  updateDeployment,
  updateNode,
  updateSystem,
} from '@/lib/mock/store';

describe('mock store', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStore(false);
  });

  it('seeds state on first access', () => {
    const state = getState();
    expect(state.config.appliance_id).toBeTruthy();
    expect(state.config.nodes).toHaveLength(3);
    expect(getLocalNodeId()).toBe('node-1');
    expect(isHeadGateway()).toBe(true);
  });

  it('persists and reloads from disk', () => {
    const state = getState();
    state.config.appliance_id = 'persisted-123';
    saveState(state);
    resetTestState({ seed: false, clearDisk: false });
    const reloaded = getState();
    expect(reloaded.config.appliance_id).toBe('persisted-123');
  });

  it('falls back to seed when disk state is corrupt', () => {
    const stateFile = path.join(process.env.APPLIANCE_CONSOLE_DATA_DIR!, 'state.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, '{not-json');
    resetTestState({ seed: false, clearDisk: false });
    const state = getState();
    expect(state.config.nodes.length).toBeGreaterThan(0);
  });

  it('creates the data directory on first persist', () => {
    const nestedDir = path.join(process.env.APPLIANCE_CONSOLE_DATA_DIR!, 'persist-nested');
    process.env.APPLIANCE_CONSOLE_DATA_DIR = nestedDir;
    resetTestState({ seed: true, persist: true, clearDisk: false });
    expect(fs.existsSync(nestedDir)).toBe(true);
    expect(fs.existsSync(path.join(nestedDir, 'state.json'))).toBe(true);
    process.env.APPLIANCE_CONSOLE_DATA_DIR = path.dirname(nestedDir);
  });

  it('fills missing head status and local node id when loading from disk', () => {
    const state = getState();
    delete (state.status as { head?: unknown }).head;
    state.local_node_id = '';
    saveState(state);
    resetTestState({ seed: false, clearDisk: false });
    const reloaded = getState();
    expect(reloaded.status.head.head_node_id).toBe('node-1');
    expect(reloaded.local_node_id).toBe('node-1');
  });

  it('seeds disk state when resetTestState uses persist option', () => {
    resetTestState({ seed: true, persist: true, clearDisk: true });
    const stateFile = path.join(process.env.APPLIANCE_CONSOLE_DATA_DIR!, 'state.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    resetTestState({ seed: false, clearDisk: false });
    expect(getState().config.nodes.length).toBeGreaterThan(0);
  });

  it('uses network head_ip when head node is missing', () => {
    const state = getState();
    state.config.cluster.head_node_id = 'missing-head';
    state.config.system.network.head_ip = '192.168.99.1';
    saveState(state);
    resetTestState({ seed: false, clearDisk: false });
    expect(getStatus().head.head_ip).toBe('192.168.99.1');
  });

  it('migrates v1 config loaded from disk', () => {
    const stateFile = path.join(process.env.APPLIANCE_CONSOLE_DATA_DIR!, 'state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        config: v1Config,
        status: {
          state: 'READY',
          last_error: null,
          last_reconcile_ts: 0,
          events: [],
        },
        local_node_id: 'node-1',
        storage_usage: { total_bytes: 1, used_bytes: 0, paths: {} },
      }),
    );
    resetTestState({ seed: false, clearDisk: false });
    const reloaded = getState();
    expect(reloaded.config.version).toBe(2);
    expect(reloaded.config.cluster.serving_mode).toBe('distributed');
  });

  it('sets config and syncs head flags', () => {
    const config = minimalConfig({ appliance_id: 'updated' });
    const parsed = setConfig(config);
    expect(parsed.appliance_id).toBe('updated');
    expect(getConfig().cluster.head_node_id).toBe('node-1');
    expect(getConfig().nodes.find((n) => n.id === 'node-1')?.is_head).toBe(true);
  });

  it('updates cluster without head change', () => {
    vi.useFakeTimers();
    const updated = updateCluster({ global_defaults: { autoscale_enabled: false } });
    expect(updated.cluster.global_defaults.autoscale_enabled).toBe(false);
    expect(getStatus().state).toBe('RECONCILING');
    vi.advanceTimersByTime(9000);
    expect(getStatus().state).toBe('READY');
  });

  it('delegates cluster head change to migrateHead', () => {
    const config = updateCluster({ head_node_id: 'node-2' });
    expect(config.cluster.head_node_id).toBe('node-2');
    expect(config.cluster.head_epoch).toBe(2);
  });

  it('uses head node id when previous head record is missing during migration', () => {
    const state = getState();
    state.config.cluster.head_node_id = 'stale-head';
    saveState(state);
    resetTestState({ seed: false, clearDisk: false });
    migrateHead('node-2');
    expect(getConfig().cluster.head_node_id).toBe('node-2');
  });

  it('defaults gpu utilization when metric is missing', () => {
    const state = getState();
    delete state.config.nodes[0].gpus[0].utilization_pct;
    saveState(state);
    resetTestState({ seed: false, clearDisk: false });
    getStatus();
    expect(getConfig().nodes[0].gpus[0].utilization_pct).toBeGreaterThanOrEqual(5);
  });

  it('migrates head successfully and broadcasts', () => {
    const messages: unknown[] = [];
    subscribeWs((msg) => messages.push(msg));
    const result = migrateHead('node-2');
    expect(result.success).toBe(true);
    expect(result.impact.deployments_rescheduled).toBe(1);
    expect(getConfig().cluster.head_node_id).toBe('node-2');
    expect(messages.some((m) => (m as { channel: string }).channel === 'head.changed')).toBe(true);
  });

  it('rejects head migration for missing or offline nodes', () => {
    expect(migrateHead('missing').success).toBe(false);
    updateNode('node-2', { status: 'offline' });
    expect(migrateHead('node-2').success).toBe(false);
    expect(migrateHead('node-1').success).toBe(true);
  });

  it('updates node and can promote via is_head', () => {
    const updated = updateNode('node-2', { labels: ['fast'] });
    expect(updated?.labels).toContain('fast');
    const promoted = updateNode('node-2', { is_head: true });
    expect(promoted?.is_head).toBe(true);
    expect(getConfig().cluster.head_node_id).toBe('node-2');
  });

  it('returns null when updating unknown node', () => {
    expect(updateNode('missing', { labels: [] })).toBeNull();
  });

  it('manages deployments', () => {
    const dep = sampleDeployment({ id: 'dep-new' });
    createDeployment(dep);
    expect(listDeployments()).toHaveLength(3);
    expect(getDeployment('dep-new')?.display_name).toBe('test-model');

    const changed = updateDeployment('dep-new', { ...dep, display_name: 'renamed' });
    expect(changed?.display_name).toBe('renamed');
    expect(updateDeployment('missing', dep)).toBeNull();

    expect(deleteDeployment('dep-new')).toBe(true);
    expect(deleteDeployment('missing')).toBe(false);
  });

  it('updates system settings and storage mounts', () => {
    vi.useFakeTimers();
    const system = getConfig().system;
    updateSystem({ ...system, security: { api_token_set: false } });
    expect(getConfig().system.security.api_token_set).toBe(false);

    const mount = addMount({
      id: 'mount-test',
      type: 'nfs',
      remote: '10.0.0.5:/data',
      local_path: '/mnt/data',
    });
    expect(mount.id).toBe('mount-test');
    expect(removeMount('mount-test')).toBe(true);
    expect(removeMount('missing')).toBe(false);
    vi.advanceTimersByTime(9000);
  });

  it('adds events and completes reconciliation', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    subscribeWs(() => undefined);
    startReconcile('testing reconcile');
    expect(getStatus().state).toBe('RECONCILING');
    vi.advanceTimersByTime(8000);
    expect(getStatus().state).toBe('READY');
    addEvent('manual event', 'warn');
    expect(getStatus().events[0].message).toBe('manual event');
  });

  it('returns live status metrics and storage usage', () => {
    const status = getStatus();
    expect(status.head.head_node_id).toBe('node-1');
    expect(status.events.length).toBeGreaterThan(0);
    for (const node of getConfig().nodes) {
      for (const gpu of node.gpus) {
        expect(gpu.utilization_pct).toBeGreaterThanOrEqual(5);
        expect(gpu.utilization_pct).toBeLessThanOrEqual(95);
      }
    }
    const storage = getStorage();
    expect(storage.total_bytes).toBeGreaterThan(0);
    expect(storage.paths['/models/hf-cache']).toBeDefined();
  });

  it('resetTestState accepts default options', () => {
    resetTestState();
    expect(getState().config.nodes.length).toBeGreaterThan(0);
  });

  it('unsubscribes websocket listeners', () => {
    const messages: unknown[] = [];
    const unsubscribe = subscribeWs((msg) => messages.push(msg));
    unsubscribe();
    addEvent('should not arrive');
    expect(messages).toHaveLength(0);
  });
});