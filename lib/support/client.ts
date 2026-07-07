import type {
  DiagnosticBundle,
  EntitlementResponse,
  TicketCreateResponse,
  TicketListResponse,
  TicketStatusResponse,
} from '@/lib/support/types';
import {
  mockEntitlement,
  mockGetTicket,
  mockListTickets,
  mockSubmitBundle,
  MockSupportError,
} from '@/lib/support/mock';

export function isSupportEnabled(): boolean {
  return process.env.SUPPORT_ENABLED !== 'false';
}

export function getSupportBaseUrl(): string | null {
  const url = process.env.SUPPORT_SERVICE_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

function useInternalMock(): boolean {
  return isSupportEnabled() && !getSupportBaseUrl();
}

export class SupportServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'SupportServiceError';
    this.code = code;
    this.status = status;
  }
}

async function remoteFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getSupportBaseUrl();
  if (!base) {
    throw new SupportServiceError('not_configured', 'Support service URL is not configured', 503);
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new SupportServiceError(
      body.error ?? 'support_error',
      body.message ?? body.error ?? res.statusText,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export async function getEntitlement(applianceId: string): Promise<EntitlementResponse> {
  if (!isSupportEnabled()) {
    return {
      entitled: false,
      message: 'Support is not enabled on this appliance.',
    };
  }
  if (useInternalMock()) {
    return mockEntitlement(applianceId);
  }
  return remoteFetch<EntitlementResponse>(`/v1/entitlement/${encodeURIComponent(applianceId)}`);
}

export async function submitBundle(bundle: DiagnosticBundle): Promise<TicketCreateResponse> {
  if (!isSupportEnabled()) {
    throw new SupportServiceError('disabled', 'Support is not enabled on this appliance', 503);
  }
  if (useInternalMock()) {
    try {
      return await mockSubmitBundle(bundle);
    } catch (error) {
      if (error instanceof MockSupportError) {
        throw new SupportServiceError(error.code, error.message, error.status);
      }
      throw error;
    }
  }
  return remoteFetch<TicketCreateResponse>('/v1/tickets', {
    method: 'POST',
    body: JSON.stringify(bundle),
  });
}

export async function getTicket(ticketId: string): Promise<TicketStatusResponse> {
  if (!isSupportEnabled()) {
    throw new SupportServiceError('disabled', 'Support is not enabled on this appliance', 503);
  }
  if (useInternalMock()) {
    try {
      return mockGetTicket(ticketId);
    } catch (error) {
      if (error instanceof MockSupportError) {
        throw new SupportServiceError(error.code, error.message, error.status);
      }
      throw error;
    }
  }
  return remoteFetch<TicketStatusResponse>(`/v1/tickets/${encodeURIComponent(ticketId)}`);
}

export async function listTickets(applianceId: string): Promise<TicketListResponse> {
  if (!isSupportEnabled()) {
    throw new SupportServiceError('disabled', 'Support is not enabled on this appliance', 503);
  }
  if (useInternalMock()) {
    try {
      return mockListTickets(applianceId);
    } catch (error) {
      if (error instanceof MockSupportError) {
        throw new SupportServiceError(error.code, error.message, error.status);
      }
      throw error;
    }
  }
  return remoteFetch<TicketListResponse>(
    `/v1/tickets?appliance_id=${encodeURIComponent(applianceId)}`,
  );
}