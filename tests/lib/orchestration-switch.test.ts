import { describe, expect, it, vi } from 'vitest';

import {
  describeOrchestrationSwitch,
  waitForOrchestrationSettle,
} from '@/lib/orchestration-switch';

describe('describeOrchestrationSwitch', () => {
  it('describes backend switches as disruptive', () => {
    const copy = describeOrchestrationSwitch('compute_backend', 'federation', 'cluster', 2);
    expect(copy.title).toContain('inference backend');
    expect(copy.message).toContain('Federated inference');
    expect(copy.message).toContain('Clustered inference');
    expect(copy.message).toContain('2 active deployment');
  });

  it('describes federation layout switches', () => {
    const copy = describeOrchestrationSwitch(
      'federation_layout',
      'replicated',
      'diverse',
      1,
    );
    expect(copy.message).toContain('Replicated');
    expect(copy.message).toContain('Diverse');
  });
});

describe('waitForOrchestrationSettle', () => {
  it('ignores stale READY until reconciliation starts', async () => {
    vi.useFakeTimers();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ state: 'READY' })
      .mockResolvedValueOnce({ state: 'RECONCILING' })
      .mockResolvedValueOnce({ state: 'READY' });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 10_000,
      intervalMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result).toEqual({ state: 'READY', settled: true });
    expect(poll).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('resolves when READY arrives on the final poll after the deadline window', async () => {
    vi.useFakeTimers();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ state: 'RECONCILING' })
      .mockResolvedValueOnce({ state: 'RECONCILING' })
      .mockResolvedValueOnce({ state: 'READY' });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 2_000,
      intervalMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result).toEqual({ state: 'READY', settled: true });
    vi.useRealTimers();
  });

  it('reports unsettled when still reconciling at timeout', async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({ state: 'RECONCILING' });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 2_000,
      intervalMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toEqual({ state: 'RECONCILING', settled: false });
    vi.useRealTimers();
  });

  it('settles on READY when reconcile timestamp advances without seeing RECONCILING', async () => {
    vi.useFakeTimers();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ state: 'READY', last_reconcile_ts: 100 })
      .mockResolvedValueOnce({ state: 'READY', last_reconcile_ts: 105 });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 10_000,
      intervalMs: 1_000,
      baselineReconcileTs: 100,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result).toEqual({ state: 'READY', settled: true });
    expect(poll).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('ignores stale READY when reconcile timestamp has not advanced', async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({ state: 'READY', last_reconcile_ts: 100 });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 2_000,
      intervalMs: 1_000,
      baselineReconcileTs: 100,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toEqual({ state: 'READY', settled: false });
    vi.useRealTimers();
  });

  it('settles when a new reconcile_ready event appears', async () => {
    vi.useFakeTimers();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'READY',
        last_reconcile_ts: 100,
        events: [{ id: 'evt-1', timestamp: 't', message: 'old', level: 'info' }],
      })
      .mockResolvedValueOnce({
        state: 'READY',
        last_reconcile_ts: 100,
        events: [
          {
            id: 'evt-2',
            timestamp: 't2',
            message: 'Model serving ready',
            level: 'info',
            event: 'reconcile_ready',
          },
          { id: 'evt-1', timestamp: 't', message: 'old', level: 'info' },
        ],
      });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 10_000,
      intervalMs: 1_000,
      baselineReconcileTs: 100,
      baselineEventIds: ['evt-1'],
    });
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result).toEqual({ state: 'READY', settled: true });
    vi.useRealTimers();
  });

  it('settles on failure completion events', async () => {
    vi.useFakeTimers();
    const poll = vi.fn().mockResolvedValue({
      state: 'DEGRADED',
      last_reconcile_ts: 100,
      events: [
        {
          id: 'evt-fail',
          timestamp: 't',
          message: 'Federation placement failed',
          level: 'info',
          event: 'federation_placement_failed',
        },
      ],
    });

    const promise = waitForOrchestrationSettle(poll, {
      timeoutMs: 2_000,
      intervalMs: 1_000,
      baselineEventIds: [],
    });
    const result = await promise;

    expect(result).toEqual({ state: 'DEGRADED', settled: true });
    vi.useRealTimers();
  });
});