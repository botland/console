'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Play, Shield } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { DryRunResult, WorkflowRecord, WorkflowStatus } from '@/lib/types';

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: 'bg-slate-700 text-slate-200',
  review: 'bg-amber-500/20 text-amber-200',
  published: 'bg-emerald-500/20 text-emerald-300',
  deprecated: 'bg-rose-500/10 text-rose-300/80',
};

export default function WorkflowsPage() {
  const [items, setItems] = useState<WorkflowRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState(
    'Answer customer questions using appliance knowledge; require review for compliance topics.',
  );
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .listWorkflows()
      .then((res) => {
        setItems(res.workflows || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load workflows');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setDryRun(null);
    try {
      const res = await api.generateWorkflow({ prompt, save_as_draft: true });
      if (res.workflow) {
        setItems((prev) => [res.workflow!, ...prev.filter((w) => w.id !== res.workflow!.id)]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const transition = async (wf: WorkflowRecord, version: string, status: string) => {
    const key = `${wf.id}:${version}:${status}`;
    setBusy(key);
    setError(null);
    try {
      await api.transitionWorkflow(wf.id, version, status);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Transition failed');
    } finally {
      setBusy(null);
    }
  };

  const runDry = async (wf: WorkflowRecord, version: string) => {
    setBusy(`dry:${wf.id}`);
    setError(null);
    try {
      const result = await api.dryRunWorkflow(wf.id, version);
      setDryRun(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Dry-run failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <PageHeader
        title="Workflows"
        description="Versioned control-plane library. NL generate drafts RO steps; publish gates HITL. Agent runtime is none until a pack is installed."
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/80" />
        <p>
          Workflows cannot register write tools. High-risk steps require HITL. Invoke is blocked
          while <code className="text-slate-300">AGENT_RUNTIME=none</code>; dry-run always works.
        </p>
      </div>

      <Card className="mb-6 space-y-3">
        <div className="text-sm font-medium text-slate-200">Generate from natural language</div>
        <Label>Describe the workflow</Label>
        <textarea
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button disabled={generating || !prompt.trim()} onClick={generate}>
          {generating ? 'Generating…' : 'Generate draft'}
        </Button>
      </Card>

      {dryRun && (
        <Card className="mb-6 space-y-2 border-cyan-500/20">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Play className="h-4 w-4 text-cyan-400" />
            Dry-run {dryRun.workflow_id}@{dryRun.version} —{' '}
            <span className={dryRun.ok ? 'text-emerald-400' : 'text-rose-400'}>
              {dryRun.ok ? 'ok' : 'failed'}
            </span>
          </div>
          <p className="text-xs text-slate-500">{dryRun.detail}</p>
          {dryRun.errors.length > 0 && (
            <pre className="text-xs text-rose-300">{dryRun.errors.join('\n')}</pre>
          )}
          {dryRun.warnings.length > 0 && (
            <pre className="text-xs text-amber-300/90">{dryRun.warnings.join('\n')}</pre>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            {dryRun.step_plan.map((s) => (
              <li key={String(s.id)}>
                <span className="font-medium">{String(s.title)}</span>{' '}
                <span className="text-xs text-slate-500">
                  ({String(s.kind)}
                  {s.risk ? ` · ${String(s.risk)}` : ''}
                  {s.requires_hitl ? ' · HITL' : ''})
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="space-y-4">
        {items.length === 0 && (
          <Card className="text-sm text-slate-500">No workflows yet — generate a draft above.</Card>
        )}
        {items.map((wf) => {
          const current =
            wf.versions.find((v) => v.version === wf.current_version) || wf.versions[0];
          return (
            <Card key={wf.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GitBranch className="h-4 w-4 text-cyan-400/80" />
                    <h3 className="font-medium text-slate-100">{wf.name}</h3>
                    {current && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLORS[current.status]}`}
                      >
                        v{current.version} · {current.status}
                      </span>
                    )}
                    {wf.published_version && (
                      <span className="text-xs text-emerald-400/80">
                        published v{wf.published_version}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{wf.description || '—'}</p>
                  <p className="mt-1 text-xs text-slate-600">{wf.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {current && (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy === `dry:${wf.id}`}
                        onClick={() => runDry(wf, current.version)}
                      >
                        Dry-run
                      </Button>
                      {current.status === 'draft' && (
                        <Button
                          variant="secondary"
                          disabled={!!busy}
                          onClick={() => transition(wf, current.version, 'review')}
                        >
                          Submit review
                        </Button>
                      )}
                      {(current.status === 'review' || current.status === 'draft') && (
                        <Button
                          disabled={!!busy}
                          onClick={() => transition(wf, current.version, 'published')}
                        >
                          Publish
                        </Button>
                      )}
                      {current.status === 'published' && (
                        <Button
                          variant="danger"
                          disabled={!!busy}
                          onClick={() => transition(wf, current.version, 'deprecated')}
                        >
                          Deprecate
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {current?.definition?.steps && (
                <ol className="list-decimal space-y-1 border-t border-slate-800 pt-3 pl-5 text-sm text-slate-300">
                  {current.definition.steps.map((s) => (
                    <li key={s.id}>
                      {s.title}{' '}
                      <span className="text-xs text-slate-500">
                        ({s.kind}
                        {s.tool_name ? ` · ${s.tool_name}` : ''}
                        {s.requires_hitl ? ' · HITL' : ''})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {current?.nl_prompt && (
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-500">
                  NL: {current.nl_prompt}
                </pre>
              )}
            </Card>
          );
        })}
      </div>
    </PageState>
  );
}
