import { createHash } from 'crypto';

/**
 * Reproducible model identity keys — must match appliance-support
 * `src/qualify/facts.py` byte-for-byte so the console can check its store
 * before submitting.
 *
 * Hash the exact UTF-8 bytes of `config.json` as held/uploaded — do NOT parse
 * and re-JSON.stringify (Python and JS disagree on float forms).
 */

export function modelKeyForHf(repoId: string, revision: string): string {
  const repo = repoId.trim();
  const rev = revision.trim() || 'main';
  return `hf:${repo}@${rev}`;
}

/**
 * Returns `cfg:<sha256[:32]>` or null when config is missing / not valid JSON.
 */
export function modelKeyForConfigText(
  modelRef: string,
  configText: string | null | undefined,
): string | null {
  if (typeof configText !== 'string' || !configText.trim()) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(configText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
  } catch {
    return null;
  }
  const digest = createHash('sha256')
    .update(`${modelRef.trim()}\n${configText}`, 'utf8')
    .digest('hex');
  return `cfg:${digest.slice(0, 32)}`;
}

export function isHfModelKey(modelKey: string): boolean {
  return modelKey.startsWith('hf:');
}

export function isConfigModelKey(modelKey: string): boolean {
  return modelKey.startsWith('cfg:');
}
