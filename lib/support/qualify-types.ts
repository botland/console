/** Types for appliance-support model qualification (`/v1/qualify/*`). */

export const QUALIFY_FACTS_VERSION = '1';
export const QUALIFY_SCHEMA_VERSION = 'model-qualification.v1';

/** Keep in sync with appliance-support QUALIFY_* defaults. */
export const QUALIFY_TIMEOUT_SEC = 300;
export const QUALIFY_MAX_RETRIES = 2;
export const QUALIFY_RETRY_BACKOFF_SEC = 2;
export const QUALIFY_POLL_INTERVAL_MS = 2_000;
export const QUALIFY_POLL_MARGIN_SEC = 60;

export type QualifyCriterion =
  | 'reasoning'
  | 'intelligence'
  | 'speed'
  | 'tools'
  | 'multiuser'
  | 'coding'
  | 'multilingual'
  | 'context'
  | 'efficiency';

export const QUALIFY_CRITERIA: QualifyCriterion[] = [
  'reasoning',
  'intelligence',
  'speed',
  'tools',
  'multiuser',
  'coding',
  'multilingual',
  'context',
  'efficiency',
];

export type QualifyVerdict =
  | 'recommended'
  | 'viable'
  | 'not_recommended'
  | 'insufficient_data';

export type QualifyConfidence = 'low' | 'medium' | 'high';

export type QualifyDataCompleteness = 'rich' | 'partial' | 'minimal';

export type ScoreCard = Record<QualifyCriterion, number>;

export type ModelQualification = {
  model_ref: string;
  verdict: QualifyVerdict;
  confidence: QualifyConfidence;
  summary: string;
  scores: ScoreCard;
  unknown_criteria: QualifyCriterion[];
  evidence: string[];
  caveats: string[];
  recommended_use_cases: string[];
  deployment_notes: string;
  data_completeness: QualifyDataCompleteness;
};

export type QualifySource = 'huggingface' | 'metadata_bundle';

export type QualifyJobStatus = 'queued' | 'running' | 'complete' | 'failed';

export type QualifyHFRequest = {
  model_ref: string;
  revision?: string;
  refresh?: boolean;
};

export type ModelMetadataBundle = {
  bundle_version: '1';
  model_ref: string;
  appliance_id?: string | null;
  files: {
    'config.json': string;
    'tokenizer_config.json'?: string;
    'generation_config.json'?: string;
    'chat_template.jinja'?: string;
    'model.safetensors.index.json'?: string;
    'README.md'?: string;
  };
  file_listing?: Array<{ name: string; size: number }>;
  refresh?: boolean;
};

export type QualifyJobCreated = {
  job_id: string;
  status: string;
  source: QualifySource | string;
  model_ref: string;
  model_key: string | null;
  requested_key: string | null;
  created_at: string;
  deduplicated?: boolean;
  /** Set when the console store already has a matching qualification. */
  cached?: boolean;
  qualification?: ModelQualification | null;
  facts_version?: string;
  schema_version?: string;
  warnings?: string[];
};

export type QualifyJobResponse = {
  job_id: string;
  status: QualifyJobStatus | string;
  source: QualifySource | string;
  model_ref: string;
  model_key: string | null;
  requested_key: string | null;
  adapter: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  facts_version: string;
  schema_version: string;
  facts: Record<string, unknown> | null;
  qualification: ModelQualification | null;
  warnings: string[];
  error: string | null;
};

/** What the console persists after a successful qualification. */
export type StoredQualification = {
  model_key: string;
  requested_key?: string | null;
  model_ref: string;
  source: QualifySource | string;
  facts_version: string;
  schema_version: string;
  qualification: ModelQualification;
  warnings: string[];
  /** True when HF revision resolved to a commit sha — safe as a durable cache hit. */
  revision_resolved: boolean;
  qualified_at: string;
  /** Optional slim facts the UI may display (never raw secrets). */
  facts_summary?: {
    active_param_b?: number | null;
    total_param_b?: number | null;
    weight_gb_fp16?: number | null;
    effective_context_tokens?: number | null;
    attention_scheme?: string | null;
  };
};

export type QualifyListResponse = {
  qualifications: StoredQualification[];
};
