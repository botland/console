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
});