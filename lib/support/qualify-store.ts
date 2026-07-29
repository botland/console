import fs from 'fs';
import path from 'path';

import {
  QUALIFY_FACTS_VERSION,
  QUALIFY_SCHEMA_VERSION,
  type StoredQualification,
} from '@/lib/support/qualify-types';

type StoreFile = {
  version: 1;
  qualifications: StoredQualification[];
};

function getDataDir(): string {
  return process.env.APPLIANCE_CONSOLE_DATA_DIR ?? path.join(process.cwd(), '.data');
}

function getStorePath(): string {
  return path.join(getDataDir(), 'qualifications.json');
}

function emptyStore(): StoreFile {
  return { version: 1, qualifications: [] };
}

function ensureDir(): void {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(): StoreFile {
  const file = getStorePath();
  if (!fs.existsSync(file)) {
    return emptyStore();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as StoreFile;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.qualifications)) {
      return emptyStore();
    }
    return raw;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreFile): void {
  ensureDir();
  const tmp = `${getStorePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, getStorePath());
}

/**
 * A stored row is a cache hit only when model_key, facts_version, and
 * schema_version all match. Branch/tag HF keys without revision_resolved are
 * never treated as durable hits (re-qualify when the branch may have moved).
 */
export function findStoredQualification(
  modelKey: string | null | undefined,
  options?: { allowUnresolved?: boolean },
): StoredQualification | null {
  if (!modelKey) return null;
  const store = readStore();
  const hit = store.qualifications.find(
    (row) =>
      row.model_key === modelKey &&
      row.facts_version === QUALIFY_FACTS_VERSION &&
      row.schema_version === QUALIFY_SCHEMA_VERSION,
  );
  if (!hit) return null;
  if (!hit.revision_resolved && !options?.allowUnresolved) {
    return null;
  }
  return hit;
}

/** Lookup by provisional HF key (repo@revision string) via requested_key or model_key. */
export function findStoredByRequestedKey(
  requestedKey: string | null | undefined,
): StoredQualification | null {
  if (!requestedKey) return null;
  const store = readStore();
  const hit = store.qualifications.find(
    (row) =>
      (row.model_key === requestedKey || row.requested_key === requestedKey) &&
      row.facts_version === QUALIFY_FACTS_VERSION &&
      row.schema_version === QUALIFY_SCHEMA_VERSION &&
      row.revision_resolved,
  );
  return hit ?? null;
}

export function listStoredQualifications(): StoredQualification[] {
  return [...readStore().qualifications].sort((a, b) =>
    b.qualified_at.localeCompare(a.qualified_at),
  );
}

/**
 * Persist a completed qualification. Replaces any prior row with the same
 * model_key. Does not store failed or unresolved-revision results.
 */
export function upsertStoredQualification(row: StoredQualification): void {
  if (!row.model_key) return;
  if (!row.revision_resolved && row.model_key.startsWith('hf:')) {
    // Branch/tag-pinned HF keys are not durable cache hits.
    return;
  }
  const store = readStore();
  const next = store.qualifications.filter((q) => q.model_key !== row.model_key);
  next.unshift(row);
  // Cap growth; oldest (end of list after unshift) drop first when oversized.
  const MAX = 500;
  writeStore({ version: 1, qualifications: next.slice(0, MAX) });
}

export function deleteStoredQualification(modelKey: string): boolean {
  const store = readStore();
  const before = store.qualifications.length;
  const qualifications = store.qualifications.filter((q) => q.model_key !== modelKey);
  if (qualifications.length === before) return false;
  writeStore({ version: 1, qualifications });
  return true;
}

/** Test helper — wipe in-memory/on-disk store for the current data dir. */
export function resetQualifyStoreForTests(): void {
  const file = getStorePath();
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}
