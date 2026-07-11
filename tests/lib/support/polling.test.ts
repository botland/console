import { describe, expect, it, vi } from 'vitest';

import {
  pollSupportTicket,
  SUPPORT_DIAGNOSIS_MAX_RETRIES,
  SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC,
  SUPPORT_DIAGNOSIS_TIMEOUT_SEC,
  SUPPORT_POLL_INTERVAL_MS,
  SUPPORT_POLL_MARGIN_SEC,
  SupportPollTimeoutError,
  supportPollTimeoutMs,
} from '@/lib/support/polling';
import type { TicketStatusResponse } from '@/lib/support/types';
import { loadContract } from '../../helpers/contracts';

function ticket(status: TicketStatusResponse['status']): TicketStatusResponse {
  return {
    ticket_id: 'ticket-1',
    status,
    created_at: '2026-07-10T12:00:00Z',
    updated_at: '2026-07-10T12:00:00Z',
  };
}

describe('support polling limits', () => {
  it('matches cross-repo contract', () => {
    const limits = loadContract<{
      diagnosis_timeout_sec: number;
      diagnosis_max_retries: number;
      diagnosis_retry_backoff_sec: number;
      poll_interval_ms: number;
      poll_margin_sec: number;
    }>('support-polling-limits.json');

    expect(SUPPORT_DIAGNOSIS_TIMEOUT_SEC).toBe(limits.diagnosis_timeout_sec);
    expect(SUPPORT_DIAGNOSIS_MAX_RETRIES).toBe(limits.diagnosis_max_retries);
    expect(SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC).toBe(limits.diagnosis_retry_backoff_sec);
    expect(SUPPORT_POLL_INTERVAL_MS).toBe(limits.poll_interval_ms);
    expect(SUPPORT_POLL_MARGIN_SEC).toBe(limits.poll_margin_sec);
  });

  it('covers full support-service diagnosis budget', () => {
    const backoff =
      SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC * 1 + SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC * 2;
    const expectedMs =
      (SUPPORT_DIAGNOSIS_TIMEOUT_SEC * (SUPPORT_DIAGNOSIS_MAX_RETRIES + 1) +
        backoff +
        SUPPORT_POLL_MARGIN_SEC) *
      1000;
    expect(supportPollTimeoutMs()).toBe(expectedMs);
  });
});

describe('pollSupportTicket', () => {
  it('returns when ticket completes', async () => {
    const fetchTicket = vi
      .fn()
      .mockResolvedValueOnce(ticket('diagnosing'))
      .mockResolvedValueOnce(ticket('complete'));

    const result = await pollSupportTicket(fetchTicket, 'ticket-1', {
      intervalMs: 1,
      timeoutMs: 100,
    });

    expect(result.status).toBe('complete');
    expect(fetchTicket).toHaveBeenCalledTimes(2);
  });

  it('throws when deadline passes before terminal status', async () => {
    const fetchTicket = vi.fn().mockResolvedValue(ticket('diagnosing'));

    await expect(
      pollSupportTicket(fetchTicket, 'ticket-1', { intervalMs: 1, timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(SupportPollTimeoutError);
  });

  it('returns on a final fetch after the deadline', async () => {
    const fetchTicket = vi
      .fn()
      .mockResolvedValueOnce(ticket('diagnosing'))
      .mockResolvedValueOnce(ticket('complete'));

    const result = await pollSupportTicket(fetchTicket, 'ticket-1', {
      intervalMs: 1,
      timeoutMs: 1,
    });

    expect(result.status).toBe('complete');
    expect(fetchTicket).toHaveBeenCalledTimes(2);
  });
});