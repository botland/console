import { SupportServiceError } from '@/lib/support/client';
import {
  getQualifyJob,
  isQualifyEnabled,
  submitQualifyHf,
  submitQualifyMetadata,
} from '@/lib/support/qualify-client';
import { modelKeyForConfigText, modelKeyForHf } from '@/lib/support/qualify-keys';
import {
  findStoredByRequestedKey,
  findStoredQualification,
  upsertStoredQualification,
} from '@/lib/support/qualify-store';
import type {
  ModelMetadataBundle,
  QualifyHFRequest,
  QualifyJobCreated,
  QualifyJobResponse,
  StoredQualification,
} from '@/lib/support/qualify-types';

function factsSummary(
  facts: Record<string, unknown> | null | undefined,
): StoredQualification['facts_summary'] {
  if (!facts || typeof facts !== 'object') return undefined;
  const serving = (facts.serving ?? {}) as Record<string, unknown>;
  const context = (facts.context ?? {}) as Record<string, unknown>;
  return {
    active_param_b: typeof serving.active_param_b === 'number' ? serving.active_param_b : null,
    total_param_b: typeof serving.total_param_b === 'number' ? serving.total_param_b : null,
    weight_gb_fp16: typeof serving.weight_gb_fp16 === 'number' ? serving.weight_gb_fp16 : null,
    effective_context_tokens:
      typeof context.effective_context_tokens === 'number'
        ? context.effective_context_tokens
        : null,
    attention_scheme:
      typeof serving.attention_scheme === 'string' ? serving.attention_scheme : null,
  };
}

function revisionResolved(job: QualifyJobResponse): boolean {
  if (job.warnings?.includes('unresolved_revision')) return false;
  const facts = job.facts;
  if (!facts || typeof facts !== 'object') {
    // Metadata-bundle keys (cfg:…) are content-addressed and always durable.
    return Boolean(job.model_key?.startsWith('cfg:'));
  }
  const access = (facts as { access?: { revision_resolved?: boolean } }).access;
  if (access && typeof access.revision_resolved === 'boolean') {
    return access.revision_resolved;
  }
  // Mock and some stubs omit access — treat cfg keys and non-branch hf sha keys as resolved.
  if (job.model_key?.startsWith('cfg:')) return true;
  if (job.model_key?.startsWith('hf:') && job.requested_key && job.model_key !== job.requested_key) {
    return true;
  }
  // If model_key still equals provisional branch form, not resolved.
  if (job.model_key && job.requested_key && job.model_key === job.requested_key) {
    const rev = job.model_key.split('@')[1] ?? '';
    // 40-char hex or longer sha-like → resolved; short branch names are not.
    if (/^[0-9a-f]{7,64}$/i.test(rev) || rev.startsWith('mocksha-')) return true;
    return false;
  }
  return Boolean(job.model_key?.startsWith('cfg:'));
}

/** Persist a completed job when the cache contract allows it. */
export function maybeStoreCompletedJob(job: QualifyJobResponse): StoredQualification | null {
  if (job.status !== 'complete' || !job.qualification || !job.model_key) {
    return null;
  }
  const resolved = revisionResolved(job);
  if (!resolved) {
    return null;
  }
  const row: StoredQualification = {
    model_key: job.model_key,
    requested_key: job.requested_key,
    model_ref: job.model_ref,
    source: job.source,
    facts_version: job.facts_version,
    schema_version: job.schema_version,
    qualification: job.qualification,
    warnings: job.warnings ?? [],
    revision_resolved: true,
    qualified_at: job.updated_at || new Date().toISOString(),
    facts_summary: factsSummary(job.facts),
  };
  upsertStoredQualification(row);
  return row;
}

function cachedResponse(stored: StoredQualification): QualifyJobCreated {
  return {
    job_id: `cached:${stored.model_key}`,
    status: 'complete',
    source: stored.source,
    model_ref: stored.model_ref,
    model_key: stored.model_key,
    requested_key: stored.requested_key ?? stored.model_key,
    created_at: stored.qualified_at,
    deduplicated: false,
    cached: true,
    qualification: stored.qualification,
    facts_version: stored.facts_version,
    schema_version: stored.schema_version,
    warnings: stored.warnings,
  };
}

export async function qualifyHfWithCache(body: QualifyHFRequest): Promise<QualifyJobCreated> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }

  const repo = body.model_ref.trim();
  const revision = (body.revision ?? 'main').trim() || 'main';
  const requestedKey = modelKeyForHf(repo, revision);

  if (!body.refresh) {
    const hit =
      findStoredQualification(requestedKey) ?? findStoredByRequestedKey(requestedKey);
    if (hit) {
      return cachedResponse(hit);
    }
  }

  return submitQualifyHf({ model_ref: repo, revision, refresh: body.refresh });
}

export async function qualifyMetadataWithCache(
  bundle: ModelMetadataBundle,
): Promise<QualifyJobCreated> {
  if (!isQualifyEnabled()) {
    throw new SupportServiceError('disabled', 'Model qualification is not enabled', 503);
  }

  const configText = bundle.files?.['config.json'];
  const modelKey = modelKeyForConfigText(bundle.model_ref, configText);

  if (!bundle.refresh && modelKey) {
    const hit = findStoredQualification(modelKey);
    if (hit) {
      return cachedResponse(hit);
    }
  }

  return submitQualifyMetadata(bundle);
}

export async function fetchQualifyJobAndStore(jobId: string): Promise<QualifyJobResponse> {
  const job = await getQualifyJob(jobId);
  if (job.status === 'complete') {
    maybeStoreCompletedJob(job);
  }
  return job;
}
