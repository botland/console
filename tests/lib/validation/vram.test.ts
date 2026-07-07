import { describe, expect, it } from 'vitest';

import {
  capContextLength,
  checkVramForModel,
  estimateWeightGb,
  estimateWeightMb,
  vramFitsOnDevices,
} from '@/lib/validation/vram';

const RTX_3070_TI_MB = 8 * 1024;

describe('vram budgeting', () => {
  it('estimates AWQ weights smaller than fp16', () => {
    const fp16 = estimateWeightGb('meta-llama/Llama-3.1-8B-Instruct');
    const awq = estimateWeightGb('casperhansen/llama-3-8b-instruct-awq');
    expect(fp16).toBe(16);
    expect(awq).toBeCloseTo(5.36, 1);
    expect(estimateWeightMb('casperhansen/llama-3-8b-instruct-awq')).toBeCloseTo(5489, -1);
  });

  it('rejects AWQ 8B at context 8192 on 8 GB GPU with 0.85 util', () => {
    expect(
      vramFitsOnDevices(
        'casperhansen/llama-3-8b-instruct-awq',
        8192,
        0.85,
        RTX_3070_TI_MB,
      ),
    ).toBe(false);
    const msg = checkVramForModel(
      'casperhansen/llama-3-8b-instruct-awq',
      8192,
      0.85,
      RTX_3070_TI_MB,
      'NVIDIA GeForce RTX 3070 Ti',
    );
    expect(msg).toContain('VRAM likely insufficient');
    expect(msg).toContain('context_length=512');
  });

  it('accepts AWQ 8B at context 512 on 8 GB GPU', () => {
    expect(
      vramFitsOnDevices(
        'casperhansen/llama-3-8b-instruct-awq',
        512,
        0.85,
        RTX_3070_TI_MB,
      ),
    ).toBe(true);
  });

  it('caps context for tight 8 GB GPUs', () => {
    expect(
      capContextLength(
        'casperhansen/llama-3-8b-instruct-awq',
        8192,
        0.85,
        RTX_3070_TI_MB,
      ),
    ).toBe(512);
  });
});