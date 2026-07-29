import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as listGet } from '@/app/api/qualify/route';
import { POST as hfPost } from '@/app/api/qualify/hf/route';
import { GET as jobGet } from '@/app/api/qualify/jobs/[id]/route';
import { POST as metadataPost } from '@/app/api/qualify/metadata/route';
import { resetMockQualifyJobs } from '@/lib/support/qualify-mock';
import { resetQualifyStoreForTests } from '@/lib/support/qualify-store';
import { pollQualifyJob } from '@/lib/support/qualify-polling';

describe('qualify API routes (mock support)', () => {
  beforeEach(() => {
    resetQualifyStoreForTests();
    resetMockQualifyJobs();
    vi.stubEnv('SUPPORT_ENABLED', 'true');
    vi.stubEnv('SUPPORT_SERVICE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetQualifyStoreForTests();
    resetMockQualifyJobs();
  });

  it('rejects missing model_ref', async () => {
    const req = new NextRequest('http://localhost/api/qualify/hf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await hfPost(req);
    expect(res.status).toBe(400);
  });

  it('qualifies an HF model, stores the result, and serves a cache hit', async () => {
    const req = new NextRequest('http://localhost/api/qualify/hf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_ref: 'Qwen/Qwen3-8B', revision: 'main' }),
    });
    const createdRes = await hfPost(req);
    expect(createdRes.status).toBe(202);
    const created = await createdRes.json();
    expect(created.job_id).toBeTruthy();
    expect(created.requested_key).toBe('hf:Qwen/Qwen3-8B@main');

    const job = await pollQualifyJob(
      async (id) => {
        const res = await jobGet(new NextRequest(`http://localhost/api/qualify/jobs/${id}`), {
          params: Promise.resolve({ id }),
        });
        expect(res.ok).toBe(true);
        return res.json();
      },
      created.job_id,
      { intervalMs: 10, timeoutMs: 5000 },
    );
    expect(job.status).toBe('complete');
    expect(job.qualification?.verdict).toBeTruthy();
    expect(job.qualification?.scores.speed).toBeGreaterThanOrEqual(1);

    const listRes = await listGet();
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.qualifications.length).toBeGreaterThanOrEqual(1);

    const cachedRes = await hfPost(
      new NextRequest('http://localhost/api/qualify/hf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_ref: 'Qwen/Qwen3-8B', revision: 'main' }),
      }),
    );
    expect(cachedRes.status).toBe(200);
    const cached = await cachedRes.json();
    expect(cached.cached).toBe(true);
    expect(cached.qualification?.model_ref).toBeTruthy();
  });

  it('qualifies from an uploaded metadata bundle', async () => {
    const config = JSON.stringify({
      model_type: 'llama',
      num_hidden_layers: 32,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      hidden_size: 4096,
      max_position_embeddings: 8192,
    });
    const req = new NextRequest('http://localhost/api/qualify/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle_version: '1',
        model_ref: '/models/demo-7b',
        files: { 'config.json': config },
      }),
    });
    const createdRes = await metadataPost(req);
    expect(createdRes.status).toBe(202);
    const created = await createdRes.json();

    const job = await pollQualifyJob(
      async (id) => {
        const res = await jobGet(new NextRequest(`http://localhost/api/qualify/jobs/${id}`), {
          params: Promise.resolve({ id }),
        });
        return res.json();
      },
      created.job_id,
      { intervalMs: 10, timeoutMs: 5000 },
    );
    expect(job.status).toBe('complete');
    expect(job.model_key?.startsWith('cfg:')).toBe(true);
  });
});
