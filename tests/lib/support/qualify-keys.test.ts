import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
  isConfigModelKey,
  isHfModelKey,
  modelKeyForConfigText,
  modelKeyForHf,
} from '@/lib/support/qualify-keys';

describe('qualify-keys', () => {
  it('builds HF keys matching appliance-support', () => {
    expect(modelKeyForHf('Qwen/Qwen3-8B', 'abc123')).toBe('hf:Qwen/Qwen3-8B@abc123');
    expect(modelKeyForHf('Qwen/Qwen3-8B', '')).toBe('hf:Qwen/Qwen3-8B@main');
    expect(modelKeyForHf('  org/model  ', ' main ')).toBe('hf:org/model@main');
  });

  it('hashes exact config text bytes (not re-serialised JSON)', () => {
    const text = '{"model_type":"llama","rms_norm_eps":1e-05,"rope_theta":1000000.0}';
    const digest = createHash('sha256')
      .update(`/models/demo-7b\n${text}`, 'utf8')
      .digest('hex')
      .slice(0, 32);
    expect(modelKeyForConfigText('/models/demo-7b', text)).toBe(`cfg:${digest}`);
  });

  it('differs when float text forms differ', () => {
    const a = modelKeyForConfigText('m', '{"eps":1e-05}');
    const b = modelKeyForConfigText('m', '{"eps":1e-5}');
    expect(a).not.toBe(b);
  });

  it('returns null for missing or invalid config', () => {
    expect(modelKeyForConfigText('/models/demo', null)).toBeNull();
    expect(modelKeyForConfigText('/models/demo', '')).toBeNull();
    expect(modelKeyForConfigText('/models/demo', 'not json')).toBeNull();
    expect(modelKeyForConfigText('/models/demo', '[1,2,3]')).toBeNull();
  });

  it('classifies key prefixes', () => {
    expect(isHfModelKey('hf:a@b')).toBe(true);
    expect(isConfigModelKey('cfg:abc')).toBe(true);
    expect(isHfModelKey('cfg:abc')).toBe(false);
  });
});
