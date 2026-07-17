'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Shield } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type {
  AccessAuditDecision,
  AccessAuditResponse,
  AccessReadyResponse,
  EffectiveToolsResponse,
  PepStatusResponse,
} from '@/lib/types';

function formatTs(ts: number): string {
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function AccessPage() {
  const [data, setData] = useState<AccessAuditResponse | null>(null);
  const [pep, setPep] = useState<PepStatusResponse | null>(null);
  const [tools, setTools] = useState<EffectiveToolsResponse | null>(null);
  const [ready, setReady] = useState<AccessReadyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterAllowed, setFilterAllowed] = useState<'all' | 'allow' | 'deny'>('all');
  const [subject, setSubject] = useState('');
  const [kQuery, setKQuery] = useState('');
  const [kBusy, setKBusy] = useState(false);
  const [kResult, setKResult] = useState<string | null>(null);
  const [kError, setKError] = useState<string | null>(null);
  const [sqlText, setSqlText] = useState('SELECT 1 AS n');
  const [sqlBusy, setSqlBusy] = useState(false);
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const runKnowledge = async () => {
    const q = kQuery.trim();
    if (!q) return;
    setKBusy(true);
    setKError(null);
    setKResult(null);
    try {
      const res = await api.knowledgeSearch({ query: q, top_k: 5 });
      const lines = (res.hits || []).map(
        (h, i) =>
          `${i + 1}. ${h.source_uri || h.title || h.chunk_id || 'hit'} (${(h.score ?? 0).toFixed(3)}) — ${(h.text || '').slice(0, 160)}`,
      );
      setKResult(
        [
          `policy: ${res.policy_reason || 'ok'} · resource: ${res.resource_uri || '—'}`,
          `groups: ${(res.groups_applied || []).join(', ') || '—'}`,
          lines.length ? lines.join('\n') : '(no hits)',
        ].join('\n'),
      );
      load();
    } catch (e) {
      setKError(e instanceof ApiError ? e.message : 'Knowledge search failed');
    } finally {
      setKBusy(false);
    }
  };

  const runSql = async () => {
    const sql = sqlText.trim();
    if (!sql) return;
    setSqlBusy(true);
    setSqlError(null);
    setSqlResult(null);
    try {
      const res = await api.sqlQuery({ sql, max_rows: 20 });
      const header = (res.columns || []).join('\t');
      const body = (res.rows || [])
        .map((r) => (Array.isArray(r) ? r.join('\t') : String(r)))
        .join('\n');
      setSqlResult(
        [
          `policy: ${res.policy_reason || 'ok'} · resource: ${res.resource_uri || '—'} · ${res.backend_label || res.backend || ''}`,
          header,
          body || '(no rows)',
          res.truncated ? '… truncated' : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      load();
    } catch (e) {
      setSqlError(e instanceof ApiError ? e.message : 'SQL query failed');
    } finally {
      setSqlBusy(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: { limit: number; subject?: string; allowed?: boolean } = { limit: 100 };
    if (subject.trim()) params.subject = subject.trim();
    if (filterAllowed === 'allow') params.allowed = true;
    if (filterAllowed === 'deny') params.allowed = false;
    return Promise.all([
      api.listAccessAudit(params),
      api.getPepStatus().catch(() => null),
      api.listEffectiveTools().catch(() => null),
      api.getAccessReady().catch(() => null),
    ])
      .then(([res, pepStatus, toolsRes, readyRes]) => {
        setData(res);
        setPep(pepStatus);
        setTools(toolsRes);
        setReady(readyRes);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load access audit');
        setLoading(false);
      });
  }, [filterAllowed, subject]);

  useEffect(() => {
    load();
  }, [load]);

  const decisions: AccessAuditDecision[] = data?.decisions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access audit"
        description="Policy decisions from the OwnEdge PDP/PEP (who was allowed or denied which action)."
      />

      {pep && (
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">PEP mode</div>
            <div className="mt-1 font-mono text-sm text-cyan-300">
              {pep.effective_mode || pep.mode}
              {pep.effective_mode && pep.effective_mode !== pep.mode ? (
                <span className="ml-2 text-xs text-slate-500">(configured {pep.mode})</span>
              ) : null}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">SSO</div>
            <div className="mt-1 text-sm text-slate-200">
              {pep.sso_enabled ? 'enabled' : 'off'}
              {pep.sso_strict_elevation ? ' · soft elevates to strict' : ''}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Sessions</div>
            <div className="mt-1 text-sm text-slate-200">{pep.active_sessions ?? 0} active</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Chat path</div>
            <div className="mt-1 font-mono text-xs text-slate-400">
              {pep.v1_via_controller ? 'controller /v1' : 'direct LiteLLM'}
            </div>
          </div>
        </Card>
      )}

      {ready && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-slate-200">Production readiness</div>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                ready.overall === 'ready'
                  ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-400'
                  : ready.overall === 'lab_ok'
                    ? 'border-sky-800/50 bg-sky-950/40 text-sky-300'
                    : ready.overall === 'not_ready'
                      ? 'border-rose-800/50 bg-rose-950/40 text-rose-300'
                      : 'border-amber-800/50 bg-amber-950/40 text-amber-300'
              }`}
            >
              {ready.overall}
            </span>
            <span className="text-xs text-slate-500">{ready.overall_label}</span>
          </div>
          <ul className="space-y-2">
            {ready.checks.map((c) => (
              <li key={c.id} className="text-xs">
                <span
                  className={
                    c.status === 'pass'
                      ? 'text-emerald-400'
                      : c.status === 'fail'
                        ? 'text-rose-300'
                        : c.status === 'warn'
                          ? 'text-amber-300'
                          : 'text-slate-500'
                  }
                >
                  [{c.status}]
                </span>{' '}
                <span className="text-slate-300">{c.title}</span>
                <span className="text-slate-500"> — {c.detail}</span>
                {c.remediation && (c.status === 'fail' || c.status === 'warn') && (
                  <div className="ml-12 mt-0.5 text-slate-600">→ {c.remediation}</div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tools && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-slate-200">Effective tools</div>
            <p className="text-xs text-slate-500">
              {tools.count_allowed ?? tools.allowed_tools?.length ?? 0} allowed
              {(tools.count_denied ?? tools.denied_tools?.length ?? 0) > 0
                ? ` · ${tools.count_denied ?? tools.denied_tools.length} denied`
                : ''}
              {tools.auth?.subject ? ` · ${tools.auth.subject}` : ''}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Catalog ∩ PDP for the console caller (
            <code className="text-slate-400">GET /agent/tools/effective</code>
            ). LiteLLM may still expose a wider global set until MCP traffic uses the PEP.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(tools.allowed_tools || []).map((t) => (
              <span
                key={t}
                className="rounded-md border border-emerald-800/40 bg-emerald-950/30 px-2 py-0.5 font-mono text-[11px] text-emerald-300/90"
              >
                {t}
              </span>
            ))}
            {(tools.allowed_tools || []).length === 0 && (
              <span className="text-xs text-slate-500">No tools allowed for this identity.</span>
            )}
          </div>
          {(tools.denied_tools || []).length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer text-slate-400">
                Denied tools ({tools.denied_tools.length})
              </summary>
              <ul className="mt-2 space-y-1 font-mono">
                {tools.denied_tools.slice(0, 20).map((d) => (
                  <li key={d.tool}>
                    <span className="text-rose-300/80">{d.tool}</span>
                    <span className="text-slate-600"> — {d.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="text-sm font-medium text-slate-200">Knowledge search (PEP)</div>
          <p className="text-xs text-slate-500">
            Calls <code className="text-slate-400">POST /knowledge/search</code> with console
            identity — groups filter acl_tags. Does not use the LLM.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Search query"
              value={kQuery}
              onChange={(e) => setKQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runKnowledge()}
            />
            <Button type="button" onClick={runKnowledge} disabled={kBusy || !kQuery.trim()}>
              {kBusy ? '…' : 'Search'}
            </Button>
          </div>
          {kError && <p className="text-xs text-rose-300">{kError}</p>}
          {kResult && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 whitespace-pre-wrap">
              {kResult}
            </pre>
          )}
        </Card>
        <Card className="space-y-3">
          <div className="text-sm font-medium text-slate-200">SQL query (PEP)</div>
          <p className="text-xs text-slate-500">
            Calls <code className="text-slate-400">POST /sql/query</code> — SELECT only, source
            ACL enforced.
          </p>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200"
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
          />
          <Button type="button" onClick={runSql} disabled={sqlBusy || !sqlText.trim()}>
            {sqlBusy ? '…' : 'Run query'}
          </Button>
          {sqlError && <p className="text-xs text-rose-300">{sqlError}</p>}
          {sqlResult && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400 whitespace-pre-wrap">
              {sqlResult}
            </pre>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject filter</Label>
            <Input
              id="subject"
              placeholder="user@company.com"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outcome">Outcome</Label>
            <select
              id="outcome"
              className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
              value={filterAllowed}
              onChange={(e) => setFilterAllowed(e.target.value as 'all' | 'allow' | 'deny')}
            >
              <option value="all">All</option>
              <option value="allow">Allowed only</option>
              <option value="deny">Denied only</option>
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {data && (
          <p className="text-xs text-slate-500">
            Showing {data.count} decision{data.count === 1 ? '' : 's'}
            {data.admin_view ? ' (admin view)' : ' (your decisions only)'}
            {data.viewer ? ` · viewer ${data.viewer}` : ''}
          </p>
        )}
      </Card>

      <PageState loading={loading && !data} error={error}>
        {decisions.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center text-slate-400">
            <Shield className="h-8 w-8 text-slate-600" />
            <p className="text-sm">No access decisions recorded yet.</p>
            <p className="max-w-md text-xs text-slate-500">
              Decisions appear when callers hit /access/me, tool authorize, chat proxy, or knowledge
              search with identity headers.
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {decisions.map((d, i) => (
                  <tr key={d.id ?? `${d.ts}-${i}`} className="text-slate-300">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {formatTs(d.ts)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{d.subject || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-cyan-300/90">{d.action}</td>
                    <td
                      className="max-w-[220px] truncate px-4 py-2.5 font-mono text-xs text-slate-400"
                      title={d.resource}
                    >
                      {d.resource || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${
                          d.allowed
                            ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-400'
                            : 'border-rose-800/50 bg-rose-950/40 text-rose-300'
                        }`}
                      >
                        {d.allowed ? 'allow' : 'deny'}
                      </span>
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-2.5 text-xs text-slate-500"
                      title={d.reason}
                    >
                      {d.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </PageState>
    </div>
  );
}
