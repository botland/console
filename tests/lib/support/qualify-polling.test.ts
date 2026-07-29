import { describe, expect, it, vi } from 'vitest';

import {
  pollQualifyJob,
  qualifyPollTimeoutMs,
  QualifyPollTimeoutError,
} from '@/lib/support/qualify-polling';
import {
  QUALIFY_MAX_RETRIES,
  QUALIFY_POLL_MARGIN_SEC,
  QUALIFY_RETRY_BACKOFF_SEC,
  QUALIFY_TIMEOUT_SEC,
  type QualifyJobResponse,
} from '@/lib/support/qualify-types';

function job(status: string): QualifyJobResponse {
  return {
    job_id: 'j1',
    status,
    source: 'huggingface',
    model_ref: 'org/demo',
    model_key: 'hf:org/demo@main',
    requested_key: 'hf:org/demo@main',
    adapter: 'stub',
    created_at: '',
    updated_at: '',
    expires_at: '',
    facts_version: '1',
    schema_version: 'model-qualification.v1',
    facts: null,
    qualification: null,
    warnings: [],
    error: null,
  };
}

describe('qualify-polling', () => {
  it('computes timeout from support-service defaults', () => {
    const backoff = QUALIFY_RETRY_BACKOFF_SEC * 1 + QUALIFY_RETRY_BACKOFF_SEC * 2;
    const expected =
      (QUALIFY_TIMEOUT_SEC * (QUALIFY_MAX_RETRIES + 1) + backoff + QUALIFY_POLL_MARGIN_SEC) * 1000;
    expect(qualifyPollTimeoutMs()).toBe(expected);
  });

  it('returns when status is complete', async () => {
    const fetchJob = vi
      .fn()
      .mockResolvedValueOnce(job('queued'))
      .mockResolvedValueOnce(job('complete'));
    const result = await pollQualifyJob(fetchJob, 'j1', { intervalMs: 1, timeoutMs: 5000 });
    expect(result.status).toBe('complete');
    expect(fetchJob).toHaveBeenCalledTimes(2);
  });

  it('throws on timeout while still running', async () => {
    const fetchJob = vi.fn().mockResolvedValue(job('running'));
    await expect(
      pollQualifyJob(fetchJob, 'j1', { intervalMs: 5, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(QualifyPollTimeoutError);
  });
});
