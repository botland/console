/** Produce jq -S compatible sorted JSON for USB dongle diff. */
export function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }
    return obj;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function toSortedJson(obj: unknown, indent = 2): string {
  return JSON.stringify(sortKeys(obj), null, indent);
}