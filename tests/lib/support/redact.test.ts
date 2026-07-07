import { describe, expect, it } from 'vitest';

import { scrubSecrets } from '@/lib/support/redact';

describe('scrubSecrets', () => {
  it('redacts hf_token fields', () => {
    const input = {
      source: { type: 'huggingface', repo_id: 'org/model', hf_token: 'hf_secret123456789012345678' },
    };
    const out = scrubSecrets(input);
    expect(out.source.hf_token).toBe('[REDACTED]');
    expect(out.source.repo_id).toBe('org/model');
  });

  it('redacts bearer tokens in strings', () => {
    const out = scrubSecrets({ log: 'Authorization: Bearer abc.def-ghi' });
    expect(out.log).toContain('[REDACTED]');
    expect(out.log).not.toContain('abc.def-ghi');
  });
});