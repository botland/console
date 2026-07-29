import { randomUUID } from 'crypto';

import { modelKeyForConfigText, modelKeyForHf } from '@/lib/support/qualify-keys';
import {
  QUALIFY_CRITERIA,
  QUALIFY_FACTS_VERSION,
  QUALIFY_SCHEMA_VERSION,
  type ModelMetadataBundle,
  type ModelQualification,
  type QualifyHFRequest,
  type QualifyJobCreated,
  type QualifyJobResponse,
  type ScoreCard,
} from '@/lib/support/qualify-types';

type MockJob = QualifyJobResponse & { complete_at: number };

const jobs = new Map<string, MockJob>();

function paramBillions(ref: string): number | null {
  const match = ref.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  return match ? Number(match[1]) : null;
}

function clampKnown(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function heuristicQualification(modelRef: string): ModelQualification {
  const lower = modelRef.toLowerCase();
  const params = paramBillions(modelRef);
  const isCoder = /cod(e|er|ing)|starcoder|codestral|codellama|deepseek-coder/.test(lower);
  const isInstruct = /instruct|chat|it\b/.test(lower);
  const isQuant = /awq|gptq|gguf|int4|int8|fp8|bnb|q4|q5|q8/.test(lower);

  const scores: ScoreCard = {
    reasoning: params == null ? 0 : clampKnown(params >= 70 ? 5 : params >= 30 ? 4 : params >= 7 ? 3 : 2),
    intelligence: params == null ? 0 : clampKnown(params >= 70 ? 5 : params >= 30 ? 4 : params >= 7 ? 3 : 2),
    speed: params == null ? 0 : clampKnown(params <= 3 ? 5 : params <= 8 ? 4 : params <= 14 ? 3 : params <= 32 ? 2 : 1),
    tools: isInstruct ? 4 : 2,
    multiuser: params == null ? 0 : clampKnown(params <= 8 ? 4 : params <= 14 ? 3 : params <= 32 ? 2 : 1),
    coding: isCoder ? 5 : 0,
    multilingual: /qwen|mistral|gemma|aya|command-r/.test(lower) ? 4 : 0,
    context: /128k|131072|100k/.test(lower) ? 5 : /32k|32768|64k/.test(lower) ? 4 : 3,
    efficiency: isQuant ? 5 : params != null && params <= 8 ? 4 : 3,
  };

  const unknown = QUALIFY_CRITERIA.filter((c) => scores[c] === 0);

  let verdict: ModelQualification['verdict'] = 'viable';
  if (params == null) verdict = 'insufficient_data';
  else if (params <= 14 && isInstruct) verdict = 'recommended';
  else if (params > 70) verdict = 'viable';

  const sizeNote =
    params != null
      ? `${params}B parameters`
      : 'unknown parameter count (mock heuristic from the model name only)';

  return {
    model_ref: modelRef,
    verdict,
    confidence: params == null ? 'low' : 'medium',
    summary: `Offline mock qualification of ${modelRef} (${sizeNote}). No weights were downloaded; scores are name-based heuristics for local console testing.`,
    scores,
    unknown_criteria: unknown,
    evidence: [
      params != null ? `name_param_b=${params}` : 'name_param_b=unknown',
      isInstruct ? 'name_signals=instruct' : 'name_signals=base',
      isCoder ? 'name_signals=coding' : 'name_signals=general',
    ],
    caveats: [
      'Mock adapter: connect SUPPORT_SERVICE_URL for real Hub metadata scoring.',
      ...(params == null
        ? ['Parameter count could not be inferred from the model name.']
        : []),
    ],
    recommended_use_cases: isCoder
      ? ['Code generation and repair', 'Repository-aware assistants']
      : isInstruct
        ? ['Interactive chat', 'Tool-calling agents']
        : ['Further fine-tuning', 'Embedding or classification after adaptation'],
    deployment_notes:
      params != null
        ? `Rough fp16 footprint ~${(params * 2).toFixed(1)} GB (name heuristic only). Prefer a quantized checkpoint on smaller GPUs.`
        : 'Unable to estimate weight size from the name alone.',
    data_completeness: params == null ? 'minimal' : 'partial',
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function finishJob(job: MockJob): QualifyJobResponse {
  const qualification = heuristicQualification(job.model_ref);
  job.status = 'complete';
  job.updated_at = nowIso();
  job.qualification = qualification;
  job.adapter = 'stub';
  job.facts = {
    access: { revision_resolved: true },
    serving: {},
  };
  return publicJob(job);
}

function publicJob(job: MockJob): QualifyJobResponse {
  const { complete_at: _, ...rest } = job;
  return rest;
}

function ensureComplete(job: MockJob): QualifyJobResponse {
  if (job.status === 'complete' || job.status === 'failed') {
    return publicJob(job);
  }
  if (Date.now() >= job.complete_at) {
    return finishJob(job);
  }
  job.status = 'running';
  job.updated_at = nowIso();
  return publicJob(job);
}

function createJob(opts: {
  source: string;
  model_ref: string;
  model_key: string;
  requested_key: string;
}): QualifyJobCreated {
  const jobId = `mock-qualify-${randomUUID().slice(0, 8)}`;
  const created = nowIso();
  const job: MockJob = {
    job_id: jobId,
    status: 'queued',
    source: opts.source,
    model_ref: opts.model_ref,
    model_key: opts.model_key,
    requested_key: opts.requested_key,
    adapter: '',
    created_at: created,
    updated_at: created,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    facts_version: QUALIFY_FACTS_VERSION,
    schema_version: QUALIFY_SCHEMA_VERSION,
    facts: null,
    qualification: null,
    warnings: [],
    error: null,
    complete_at: Date.now() + 50,
  };
  jobs.set(jobId, job);
  return {
    job_id: jobId,
    status: 'queued',
    source: opts.source,
    model_ref: opts.model_ref,
    model_key: opts.requested_key,
    requested_key: opts.requested_key,
    created_at: created,
    deduplicated: false,
  };
}

export function mockQualifyHf(body: QualifyHFRequest): QualifyJobCreated {
  const repo = body.model_ref.trim();
  const revision = (body.revision ?? 'main').trim() || 'main';
  if (!repo) {
    throw new MockQualifyError('invalid_request', 'model_ref is required', 400);
  }
  const key = modelKeyForHf(repo, revision);
  // Resolved mock keys are sha-style for store durability.
  const resolved = modelKeyForHf(repo, `mocksha-${revision}`);
  const created = createJob({
    source: 'huggingface',
    model_ref: repo,
    model_key: resolved,
    requested_key: key,
  });
  // Update internal job to resolved key immediately so store can keep it.
  const job = jobs.get(created.job_id);
  if (job) {
    job.model_key = resolved;
  }
  return created;
}

export function mockQualifyMetadata(bundle: ModelMetadataBundle): QualifyJobCreated {
  const ref = bundle.model_ref?.trim();
  if (!ref) {
    throw new MockQualifyError('invalid_request', 'model_ref is required', 400);
  }
  const configText = bundle.files?.['config.json'];
  const key = modelKeyForConfigText(ref, configText);
  if (!key) {
    throw new MockQualifyError('invalid_request', 'config.json is not valid JSON', 400);
  }
  return createJob({
    source: 'metadata_bundle',
    model_ref: ref,
    model_key: key,
    requested_key: key,
  });
}

export function mockGetQualifyJob(jobId: string): QualifyJobResponse {
  const job = jobs.get(jobId);
  if (!job) {
    throw new MockQualifyError('job_not_found', 'job_not_found', 404);
  }
  return ensureComplete(job);
}

export function mockDeleteQualifyJob(jobId: string): void {
  if (!jobs.delete(jobId)) {
    throw new MockQualifyError('job_not_found', 'job_not_found', 404);
  }
}

export function resetMockQualifyJobs(): void {
  jobs.clear();
}

export class MockQualifyError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'MockQualifyError';
    this.code = code;
    this.status = status;
  }
}
