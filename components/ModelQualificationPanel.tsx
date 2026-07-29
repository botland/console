'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button, Card, Input, Label } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  pollQualifyJob,
  QualifyPollTimeoutError,
} from '@/lib/support/qualify-polling';
import {
  QUALIFY_CRITERIA,
  type ModelQualification,
  type QualifyCriterion,
  type QualifyJobResponse,
  type QualifyVerdict,
  type StoredQualification,
} from '@/lib/support/qualify-types';

const CRITERION_LABELS: Record<QualifyCriterion, string> = {
  reasoning: 'Reasoning',
  intelligence: 'Intelligence',
  speed: 'Speed',
  tools: 'Tools',
  multiuser: 'Multi-user',
  coding: 'Coding',
  multilingual: 'Multilingual',
  context: 'Context',
  efficiency: 'Efficiency',
};

const VERDICT_LABELS: Record<QualifyVerdict, string> = {
  recommended: 'Recommended',
  viable: 'Viable',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
};

const VERDICT_STYLES: Record<QualifyVerdict, string> = {
  recommended: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  viable: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  not_recommended: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  insufficient_data: 'border-slate-600 bg-slate-800/50 text-slate-300',
};

function ScoreBars({ scores, unknown }: { scores: ModelQualification['scores']; unknown: string[] }) {
  const unknownSet = new Set(unknown);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {QUALIFY_CRITERIA.map((criterion) => {
        const value = scores[criterion] ?? 0;
        const isUnknown = unknownSet.has(criterion) || value === 0;
        return (
          <div key={criterion} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{CRITERION_LABELS[criterion]}</span>
              <span className={isUnknown ? 'text-slate-500' : 'text-slate-200'}>
                {isUnknown ? '—' : `${value}/5`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${isUnknown ? 'bg-slate-700' : 'bg-cyan-500/70'}`}
                style={{ width: `${isUnknown ? 0 : (value / 5) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QualificationResult({
  qualification,
  modelKey,
  warnings,
}: {
  qualification: ModelQualification;
  modelKey?: string | null;
  warnings?: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${VERDICT_STYLES[qualification.verdict]}`}
        >
          {VERDICT_LABELS[qualification.verdict]}
        </span>
        <span className="text-xs text-slate-500">
          Confidence: {qualification.confidence} · Data: {qualification.data_completeness}
        </span>
        {modelKey && (
          <span className="truncate font-mono text-[10px] text-slate-600" title={modelKey}>
            {modelKey}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-300">{qualification.summary}</p>
      <ScoreBars scores={qualification.scores} unknown={qualification.unknown_criteria} />
      {qualification.recommended_use_cases.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Recommended uses</div>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-300">
            {qualification.recommended_use_cases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {qualification.deployment_notes && (
        <p className="text-sm text-slate-400">{qualification.deployment_notes}</p>
      )}
      {qualification.caveats.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Caveats</div>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-400">
            {qualification.caveats.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          {warnings.join(' · ')}
        </div>
      )}
    </div>
  );
}

export function ModelQualificationPanel({
  initialRepo = '',
  compact = false,
}: {
  initialRepo?: string;
  compact?: boolean;
}) {
  const [repo, setRepo] = useState(initialRepo);
  const [revision, setRevision] = useState('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    qualification: ModelQualification;
    modelKey?: string | null;
    warnings?: string[];
    cached?: boolean;
  } | null>(null);
  const [history, setHistory] = useState<StoredQualification[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const list = await api.listQualifications();
      setHistory(list.qualifications);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (initialRepo) setRepo(initialRepo);
  }, [initialRepo]);

  const applyJob = (job: QualifyJobResponse, cached = false) => {
    if (job.status === 'failed') {
      setError(job.error || 'Qualification failed');
      setResult(null);
      return;
    }
    if (job.qualification) {
      setResult({
        qualification: job.qualification,
        modelKey: job.model_key,
        warnings: job.warnings,
        cached,
      });
    }
  };

  const runQualify = async (refresh = false) => {
    const modelRef = repo.trim();
    if (!modelRef) {
      setError('Enter a Hugging Face model id (for example Qwen/Qwen3-8B).');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const created = await api.qualifyHf({
        model_ref: modelRef,
        revision: revision.trim() || 'main',
        refresh,
      });
      if (created.cached && created.qualification) {
        setResult({
          qualification: created.qualification,
          modelKey: created.model_key,
          warnings: created.warnings,
          cached: true,
        });
        await loadHistory();
        return;
      }
      if (created.status === 'complete' && created.qualification) {
        setResult({
          qualification: created.qualification,
          modelKey: created.model_key,
          warnings: created.warnings,
          cached: Boolean(created.cached),
        });
        await loadHistory();
        return;
      }

      const job = await pollQualifyJob(api.qualifyJob, created.job_id, {
        onUpdate: (j) => applyJob(j),
      });
      applyJob(job);
      await loadHistory();
    } catch (e) {
      if (e instanceof QualifyPollTimeoutError) {
        setError(e.message);
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to qualify model');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={compact ? 'p-4' : undefined}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Qualify model
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Score a Hugging Face model on reasoning, speed, tools, and more — without downloading
            weights.
          </p>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-cyan-500/60" aria-hidden />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto_auto]">
        <div>
          <Label htmlFor="qualify-repo">Hugging Face repo</Label>
          <Input
            id="qualify-repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Qwen/Qwen3-8B"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="qualify-revision">Revision</Label>
          <Input
            id="qualify-revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="main"
            disabled={busy}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={() => runQualify(false)} disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Qualifying…
              </>
            ) : (
              'Qualify'
            )}
          </Button>
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={() => runQualify(true)}
            disabled={busy}
            title="Ignore local cache and re-score"
            className="w-full sm:w-auto"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-2 border-t border-slate-800 pt-4">
          {result.cached && (
            <div className="text-xs text-slate-500">Loaded from appliance cache</div>
          )}
          <QualificationResult
            qualification={result.qualification}
            modelKey={result.modelKey}
            warnings={result.warnings}
          />
        </div>
      )}

      {!compact && history.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Previously qualified
          </div>
          <ul className="divide-y divide-slate-800/80">
            {history.slice(0, 8).map((row) => (
              <li key={row.model_key}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-slate-800/30"
                  onClick={() => {
                    setResult({
                      qualification: row.qualification,
                      modelKey: row.model_key,
                      warnings: row.warnings,
                      cached: true,
                    });
                    setRepo(row.model_ref);
                    setError(null);
                  }}
                >
                  <span className="truncate text-slate-200">{row.model_ref}</span>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${VERDICT_STYLES[row.qualification.verdict]}`}
                  >
                    {VERDICT_LABELS[row.qualification.verdict]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
