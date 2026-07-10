import type { TicketStatusResponse } from '@/lib/support/types';

/** Keep in sync with tests/contracts/support-polling-limits.json and appliance-support compose defaults. */
export const SUPPORT_DIAGNOSIS_TIMEOUT_SEC = 360;
export const SUPPORT_DIAGNOSIS_MAX_RETRIES = 2;
export const SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC = 2;
export const SUPPORT_POLL_INTERVAL_MS = 2_000;
export const SUPPORT_POLL_MARGIN_SEC = 60;

function retryBackoffTotalSec(): number {
  let total = 0;
  for (let attempt = 0; attempt < SUPPORT_DIAGNOSIS_MAX_RETRIES; attempt += 1) {
    total += SUPPORT_DIAGNOSIS_RETRY_BACKOFF_SEC * (attempt + 1);
  }
  return total;
}

export function supportPollIntervalMs(): number {
  return SUPPORT_POLL_INTERVAL_MS;
}

/** Aligns with appliance-support DIAGNOSIS_TIMEOUT_SEC × (retries + 1) plus backoff and margin. */
export function supportPollTimeoutMs(): number {
  const attempts = SUPPORT_DIAGNOSIS_MAX_RETRIES + 1;
  const totalSec =
    SUPPORT_DIAGNOSIS_TIMEOUT_SEC * attempts + retryBackoffTotalSec() + SUPPORT_POLL_MARGIN_SEC;
  return totalSec * 1000;
}

export class SupportPollTimeoutError extends Error {
  readonly ticketId: string;

  constructor(ticketId: string) {
    super('Support analysis timed out. Try again later.');
    this.name = 'SupportPollTimeoutError';
    this.ticketId = ticketId;
  }
}

export type PollSupportTicketOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (ticket: TicketStatusResponse) => void;
};

export async function pollSupportTicket(
  fetchTicket: (ticketId: string) => Promise<TicketStatusResponse>,
  ticketId: string,
  options?: PollSupportTicketOptions,
): Promise<TicketStatusResponse> {
  const intervalMs = options?.intervalMs ?? supportPollIntervalMs();
  const deadline = Date.now() + (options?.timeoutMs ?? supportPollTimeoutMs());

  while (Date.now() < deadline) {
    const ticket = await fetchTicket(ticketId);
    options?.onUpdate?.(ticket);
    if (ticket.status === 'complete' || ticket.status === 'failed') {
      return ticket;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const latest = await fetchTicket(ticketId);
  options?.onUpdate?.(latest);
  if (latest.status === 'complete' || latest.status === 'failed') {
    return latest;
  }

  throw new SupportPollTimeoutError(ticketId);
}