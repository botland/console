import {
  QUALIFY_MAX_RETRIES,
  QUALIFY_POLL_INTERVAL_MS,
  QUALIFY_POLL_MARGIN_SEC,
  QUALIFY_RETRY_BACKOFF_SEC,
  QUALIFY_TIMEOUT_SEC,
  type QualifyJobResponse,
} from '@/lib/support/qualify-types';

function retryBackoffTotalSec(): number {
  let total = 0;
  for (let attempt = 0; attempt < QUALIFY_MAX_RETRIES; attempt += 1) {
    total += QUALIFY_RETRY_BACKOFF_SEC * (attempt + 1);
  }
  return total;
}

export function qualifyPollIntervalMs(): number {
  return QUALIFY_POLL_INTERVAL_MS;
}

/** Aligns with appliance-support QUALIFY_TIMEOUT_SEC × (retries + 1) plus backoff and margin. */
export function qualifyPollTimeoutMs(): number {
  const attempts = QUALIFY_MAX_RETRIES + 1;
  const totalSec =
    QUALIFY_TIMEOUT_SEC * attempts + retryBackoffTotalSec() + QUALIFY_POLL_MARGIN_SEC;
  return totalSec * 1000;
}

export class QualifyPollTimeoutError extends Error {
  readonly jobId: string;

  constructor(jobId: string) {
    super('Model qualification timed out. Try again later.');
    this.name = 'QualifyPollTimeoutError';
    this.jobId = jobId;
  }
}

export type PollQualifyJobOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (job: QualifyJobResponse) => void;
};

export async function pollQualifyJob(
  fetchJob: (jobId: string) => Promise<QualifyJobResponse>,
  jobId: string,
  options?: PollQualifyJobOptions,
): Promise<QualifyJobResponse> {
  const intervalMs = options?.intervalMs ?? qualifyPollIntervalMs();
  const deadline = Date.now() + (options?.timeoutMs ?? qualifyPollTimeoutMs());

  while (Date.now() < deadline) {
    const job = await fetchJob(jobId);
    options?.onUpdate?.(job);
    if (job.status === 'complete' || job.status === 'failed') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const latest = await fetchJob(jobId);
  options?.onUpdate?.(latest);
  if (latest.status === 'complete' || latest.status === 'failed') {
    return latest;
  }

  throw new QualifyPollTimeoutError(jobId);
}
