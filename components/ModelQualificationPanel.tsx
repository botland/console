'use client';

import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui';
import {
  QUALIFY_CRITERIA,
  type ModelQualification,
  type QualifyCriterion,
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

export const VERDICT_LABELS: Record<QualifyVerdict, string> = {
  recommended: 'Recommended',
  viable: 'Viable',
  not_recommended: 'Not recommended',
  insufficient_data: 'Insufficient data',
};

export const VERDICT_STYLES: Record<QualifyVerdict, string> = {
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

export function QualificationResult({
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

export type QualificationView = {
  qualification: ModelQualification;
  modelKey?: string | null;
  warnings?: string[];
  cached?: boolean;
  modelRef?: string;
};

/** Modal showing a stored or just-completed model qualification. */
export function QualificationDialog({
  open,
  title = 'Model qualification',
  view,
  busy = false,
  error = null,
  onClose,
  onRequalify,
}: {
  open: boolean;
  title?: string;
  view: QualificationView | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  /** When set, show a Re-qualify action (ignored while busy). */
  onRequalify?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qualify-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="qualify-dialog-title" className="font-display text-lg font-semibold text-slate-100">
              {title}
            </h3>
            {view?.modelRef && (
              <p className="mt-1 truncate text-sm text-slate-400" title={view.modelRef}>
                {view.modelRef}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {busy && !view && (
          <div className="flex items-center gap-3 py-8 text-sm text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            Qualifying model…
          </div>
        )}

        {view && (
          <div className="space-y-2">
            {view.cached && (
              <div className="text-xs text-slate-500">Loaded from appliance cache</div>
            )}
            <QualificationResult
              qualification={view.qualification}
              modelKey={view.modelKey}
              warnings={view.warnings}
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {onRequalify && (
            <Button variant="secondary" onClick={onRequalify} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Qualifying…
                </>
              ) : (
                'Re-qualify'
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Find a stored qualification for a Hugging Face repo id (any revision key). */
export function findQualificationForRepo(
  qualifications: StoredQualification[],
  repoId: string,
): StoredQualification | null {
  const repo = repoId.trim();
  if (!repo) return null;
  return (
    qualifications.find((row) => row.model_ref.trim() === repo) ??
    qualifications.find((row) => row.model_key.includes(`hf:${repo}@`)) ??
    null
  );
}
