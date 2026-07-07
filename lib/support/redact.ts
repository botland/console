const SENSITIVE_KEYS = new Set([
  'hf_token',
  'password',
  'secret',
  'api_token',
  'token',
  'credentials',
]);

const SECRET_PATTERNS = [
  /hf_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

export function scrubSecrets<T>(value: T): T {
  return scrubValue(value) as T;
}

function scrubValue(value: unknown, key = ''): unknown {
  if (key && SENSITIVE_KEYS.has(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubValue(v, k)]),
    );
  }
  if (typeof value === 'string') {
    let scrubbed = value;
    for (const pattern of SECRET_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }
    return scrubbed;
  }
  return value;
}

export function truncateLogTail(text: string, maxLines = 200, maxBytes = 64 * 1024): string {
  const lines = text.split('\n');
  const trimmed = lines.slice(-maxLines).join('\n');
  if (trimmed.length <= maxBytes) {
    return trimmed;
  }
  return trimmed.slice(trimmed.length - maxBytes);
}