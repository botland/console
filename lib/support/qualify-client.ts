import {
  getSupportBaseUrl,
  isSupportEnabled,
  SupportServiceError,
} from '@/lib/support/client';
import {
  mockDeleteQualifyJob,
  mockGetQualifyJob,
  mockQualifyHf,
  mockQualifyMetadata,
  MockQualifyError,
} from '@/lib/support/qualify-mock';
import type {
  ModelMetadataBundle,
  QualifyHFRequest,
  QualifyJobCreated,
  QualifyJobResponse,
} from '@/lib/support/qualify-types';

function useInternalMock(): boolean {
  return isSupportEnabled() && !getSupportBaseUrl();
}

export function isQualifyEnabled(): boolean {
  return isSupportEnabled();
}

function adminToken(): string | null {
  const token = process.env.MODELS_ADMIN_TOKEN?.trim();
  return token || null;
}

function detailMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === 'string' && o.detail.trim()) return o.detail;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  return fallback;
}

async function remoteFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getSupportBaseUrl();
  if (!base) {
    throw new SupportServiceError('not_configured', 'Support service URL is not configured', 503);
  }
  const token = adminToken();
  if (!token) {
    throw new SupportServiceError(
      'not_configured',
      'MODELS_ADMIN_TOKEN is not configured for model qualification',
      503,
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Models-Admin-Token': token,
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new SupportServiceError(
      typeof (body as { error?: string }).error === 'string'
        ? (body as { error: string }).error
        : 'qualify_error',
      detailMessage(body, res.statusText),
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

function mapMockError(error: unknown): never {
  if (error instanceof MockQualifyError) {
    throw new SupportServiceError(error.code, error.message, error.status);
  }
  throw error;
}

export async function submitQualifyHf(body: QualifyHFRequest): Promise<QualifyJobCreated> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }
  if (useInternalMock()) {
    try {
      return mockQualifyHf(body);
    } catch (error) {
      mapMockError(error);
    }
  }
  return remoteFetch<QualifyJobCreated>('/v1/qualify/hf', {
    method: 'POST',
    body: JSON.stringify({
      model_ref: body.model_ref,
      revision: body.revision ?? 'main',
      refresh: body.refresh ?? false,
    }),
  });
}

export async function submitQualifyMetadata(
  bundle: ModelMetadataBundle,
): Promise<QualifyJobCreated> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }
  if (useInternalMock()) {
    try {
      return mockQualifyMetadata(bundle);
    } catch (error) {
      mapMockError(error);
    }
  }
  return remoteFetch<QualifyJobCreated>('/v1/qualify/metadata', {
    method: 'POST',
    body: JSON.stringify(bundle),
  });
}

export async function getQualifyJob(jobId: string): Promise<QualifyJobResponse> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }
  if (useInternalMock()) {
    try {
      return mockGetQualifyJob(jobId);
    } catch (error) {
      mapMockError(error);
    }
  }
  return remoteFetch<QualifyJobResponse>(`/v1/qualify/jobs/${encodeURIComponent(jobId)}`);
}

export async function deleteQualifyJob(jobId: string): Promise<void> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }
  if (useInternalMock()) {
    try {
      mockDeleteQualifyJob(jobId);
      return;
    } catch (error) {
      mapMockError(error);
    }
  }
  await remoteFetch<void>(`/v1/qualify/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
}
