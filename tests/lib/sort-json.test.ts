import { describe, expect, it } from 'vitest';

import { sortKeys, toSortedJson } from '@/lib/sort-json';

describe('sort-json', () => {
  it('sorts object keys recursively', () => {
    const input = { z: 1, a: { y: 2, b: 3 }, m: [{ c: 1, a: 2 }] };
    expect(sortKeys(input)).toEqual({
      a: { b: 3, y: 2 },
      m: [{ a: 2, c: 1 }],
      z: 1,
    });
  });

  it('returns primitives and arrays unchanged at leaf level', () => {
    expect(sortKeys(null)).toBeNull();
    expect(sortKeys('x')).toBe('x');
    expect(sortKeys([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('produces stable sorted JSON', () => {
    const json = toSortedJson({ b: 2, a: 1 });
    expect(json).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });
});