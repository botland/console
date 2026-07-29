import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteStoredQualification,
  findStoredByRequestedKey,
  findStoredQualification,
  listStoredQualifications,
  resetQualifyStoreForTests,
  upsertStoredQualification,
} from '@/lib/support/qualify-store';
import {
  QUALIFY_FACTS_VERSION,
  QUALIFY_SCHEMA_VERSION,
  type StoredQualification,
} from '@/lib/support/qualify-types';

function sample(overrides: Partial<StoredQualification> = {}): StoredQualification {
  return {
    model_key: 'hf:org/demo@mocksha-main',
    requested_key: 'hf:org/demo@main',
    model_ref: 'org/demo',
    source: 'huggingface',
    facts_version: QUALIFY_FACTS_VERSION,
    schema_version: QUALIFY_SCHEMA_VERSION,
    qualification: {
      model_ref: 'org/demo',
      verdict: 'viable',
      confidence: 'medium',
      summary: 'ok',
      scores: {
        reasoning: 3,
        intelligence: 3,
        speed: 4,
        tools: 3,
        multiuser: 3,
        coding: 0,
        multilingual: 0,
        context: 3,
        efficiency: 4,
      },
      unknown_criteria: ['coding', 'multilingual'],
      evidence: [],
      caveats: [],
      recommended_use_cases: [],
      deployment_notes: '',
      data_completeness: 'partial',
    },
    warnings: [],
    revision_resolved: true,
    qualified_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('qualify-store', () => {
  beforeEach(() => {
    resetQualifyStoreForTests();
  });

  afterEach(() => {
    resetQualifyStoreForTests();
  });

  it('stores and finds by model_key', () => {
    upsertStoredQualification(sample());
    const hit = findStoredQualification('hf:org/demo@mocksha-main');
    expect(hit?.model_ref).toBe('org/demo');
  });

  it('finds by requested_key when revision was resolved', () => {
    upsertStoredQualification(sample());
    expect(findStoredByRequestedKey('hf:org/demo@main')?.model_key).toBe(
      'hf:org/demo@mocksha-main',
    );
  });

  it('ignores unresolved HF rows for durable lookup', () => {
    upsertStoredQualification(
      sample({
        model_key: 'hf:org/demo@main',
        requested_key: 'hf:org/demo@main',
        revision_resolved: false,
      }),
    );
    // upsert refuses unresolved HF keys
    expect(listStoredQualifications()).toHaveLength(0);
  });

  it('misses when facts_version differs', () => {
    upsertStoredQualification(sample({ facts_version: '0' }));
    // stored with wrong version still on disk if we forced it — upsert doesn't validate version
    expect(findStoredQualification('hf:org/demo@mocksha-main')).toBeNull();
  });

  it('lists newest first and supports delete', () => {
    upsertStoredQualification(
      sample({ model_key: 'cfg:aaa', model_ref: 'a', qualified_at: '2026-01-01T00:00:00Z' }),
    );
    upsertStoredQualification(
      sample({ model_key: 'cfg:bbb', model_ref: 'b', qualified_at: '2026-02-01T00:00:00Z' }),
    );
    const list = listStoredQualifications();
    expect(list[0]?.model_ref).toBe('b');
    expect(deleteStoredQualification('cfg:bbb')).toBe(true);
    expect(listStoredQualifications()).toHaveLength(1);
  });
});
