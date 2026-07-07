import { describe, expect, it } from 'vitest';

import { formatNodeLabel, formatNodeLabelFromNode } from '@/lib/node-label';

describe('formatNodeLabel', () => {
  it('combines hostname and ip', () => {
    expect(formatNodeLabel('worker-1', '10.0.0.2')).toBe('worker-1 (10.0.0.2)');
  });

  it('handles partial values', () => {
    expect(formatNodeLabel('worker-1', '')).toBe('worker-1');
    expect(formatNodeLabel('', '10.0.0.2')).toBe('10.0.0.2');
    expect(formatNodeLabel('', '')).toBe('unknown node');
  });

  it('formats from node object', () => {
    expect(formatNodeLabelFromNode({ hostname: 'head', ip: '192.168.1.1' })).toBe(
      'head (192.168.1.1)',
    );
  });
});