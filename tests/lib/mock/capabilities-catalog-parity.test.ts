/**
 * F12: mock catalog must not advertise tools the product no longer has.
 *
 * When the console is checked out as a superrepo submodule, the parent
 * `capabilities.v1.yaml` is readable one directory up. When the console is
 * cloned alone the test skips — the CI job in the superrepo always has the
 * catalog.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listCapabilities, listEffectiveTools, sqlQuery } from '@/lib/mock/store';

const CATALOG_CANDIDATES = [
  resolve(__dirname, '../../../../inferedge-phase1/configs/mcp/capabilities.v1.yaml'),
  resolve(__dirname, '../../../../configs/mcp/capabilities.v1.yaml'),
];

function loadCatalogIdsAndTools(): Map<string, string[]> | null {
  const path = CATALOG_CANDIDATES.find((p) => existsSync(p));
  if (!path) return null;
  const text = readFileSync(path, 'utf8');
  // Minimal YAML extraction: enough for this catalog shape, no full parser dep.
  const map = new Map<string, string[]>();
  let currentId: string | null = null;
  let inTools = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const idMatch = line.match(/^\s+-\s+id:\s+(\S+)/);
    if (idMatch) {
      currentId = idMatch[1];
      map.set(currentId, []);
      inTools = false;
      continue;
    }
    if (currentId && line.match(/^\s+allowed_tools:\s*$/)) {
      inTools = true;
      continue;
    }
    if (inTools && currentId) {
      const tool = line.match(/^\s+-\s+(\S+)/);
      if (tool) {
        map.get(currentId)!.push(tool[1]);
        continue;
      }
      if (line.match(/^\s+\S/) && !line.match(/^\s+-/)) {
        inTools = false;
      }
    }
  }
  return map;
}

describe('mock capability catalog parity (F12)', () => {
  const catalog = loadCatalogIdsAndTools();

  it('mock capability ids and tools match the shipped catalog when present', () => {
    if (!catalog) {
      // Standalone console clone — superrepo CI always provides the file.
      expect(catalog).toBeNull();
      return;
    }
    const mock = listCapabilities().capabilities;
    const mockById = new Map(mock.map((c) => [c.id, c]));
    expect([...mockById.keys()].sort()).toEqual([...catalog.keys()].sort());
    for (const [id, tools] of catalog) {
      expect(mockById.get(id)?.allowed_tools ?? []).toEqual(tools);
    }
  });

  it('mock SQL is PostgreSQL, not SQLite', () => {
    const res = sqlQuery({ sql: 'SELECT 1' });
    expect(res.backend).toBe('postgres');
    expect(String(res.backend_label)).not.toMatch(/sqlite/i);
  });

  it('effective tools do not advertise retired knowledge_* / note_* names', () => {
    const eff = listEffectiveTools();
    for (const name of eff.allowed_tools) {
      expect(name).not.toMatch(/^knowledge_/);
      expect(name).not.toMatch(/^note_/);
    }
    for (const d of eff.denied_tools) {
      expect(d.tool).not.toMatch(/^knowledge_/);
      expect(d.tool).not.toMatch(/^note_/);
    }
  });
});
