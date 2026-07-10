'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, LifeBuoy, Loader2 } from 'lucide-react';

import { PageError, PageLoading } from '@/components/PageState';
import { ApplianceBadge } from '@/components/StatusBadge';
import { Button, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApplianceStatus } from '@/lib/status-context';
import { pollSupportTicket, SupportPollTimeoutError } from '@/lib/support/polling';
import type {
  DiagnosticBundle,
  DiagnosisResult,
  EntitlementResponse,
  TicketStatusResponse,
  TicketSummary,
} from '@/lib/support/types';

const VERDICT_LABELS: Record<DiagnosisResult['verdict'], string> = {
  likely_bug: 'Likely product issue',
  operator_actionable: 'Configuration or operation',
  insufficient_data: 'More information needed',
  unknown: 'Under review',
};

const VERDICT_STYLES: Record<DiagnosisResult['verdict'], string> = {
  likely_bug: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  operator_actionable: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  insufficient_data: 'border-slate-600 bg-slate-800/50 text-slate-300',
  unknown: 'border-slate-600 bg-slate-800/50 text-slate-300',
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SupportPage() {
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [preview, setPreview] = useState<DiagnosticBundle | null>(null);
  const { status } = useApplianceStatus();
  const [history, setHistory] = useState<TicketSummary[]>([]);
  const [userNote, setUserNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [ticket, setTicket] = useState<TicketStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const refreshPreview = useCallback(async (note = userNote) => {
    const res = await fetch(`/api/support/preview?note=${encodeURIComponent(note)}`);
    if (res.ok) {
      setPreview((await res.json()) as DiagnosticBundle);
    }
  }, [userNote]);

  const loadHistory = useCallback(async () => {
    try {
      const list = await api.supportTickets();
      setHistory(list.tickets);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadTicket = async (ticketId: string) => {
    const res = await fetch(`/api/support/tickets/${ticketId}`);
    if (!res.ok) return;
    setTicket((await res.json()) as TicketStatusResponse);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const entitlementRes = await fetch('/api/support/entitlement').then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError((body as { error?: string }).error ?? res.statusText, res.status);
        }
        return res.json() as Promise<EntitlementResponse>;
      });
      setEntitlement(entitlementRes);
      if (entitlementRes.entitled) {
        await Promise.all([refreshPreview(''), loadHistory()]);
      }
      setLoading(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load support page');
      setLoading(false);
    }
  }, [refreshPreview, loadHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const pollTicket = async (ticketId: string) => {
    setPolling(true);
    setSubmitError(null);
    try {
      const body = await pollSupportTicket(api.supportTicket, ticketId, {
        onUpdate: setTicket,
      });
      setTicket(body);
      await loadHistory();
    } catch (error) {
      if (error instanceof SupportPollTimeoutError) {
        setSubmitError(error.message);
        await loadHistory();
        return;
      }
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        return;
      }
      setSubmitError(error instanceof Error ? error.message : 'Failed to load analysis');
    } finally {
      setPolling(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setTicket(null);
    try {
      const res = await fetch('/api/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_note: userNote }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError((body as { message?: string }).message ?? 'Failed to send report');
        setSubmitting(false);
        return;
      }
      const { ticket_id } = body as { ticket_id: string };
      setSubmitting(false);
      await pollTicket(ticket_id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to send report');
      setSubmitting(false);
    }
  };

  if (loading && !entitlement) {
    return <PageLoading message="Loading support…" />;
  }

  if (error && !entitlement) {
    return <PageError error={error} onRetry={load} />;
  }

  return (
    <>
      <PageHeader
        title="Support"
        description="Send a diagnostic report when something is not working as expected."
      />

      {entitlement && !entitlement.entitled && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {entitlement.message ?? 'Support subscription required for this appliance.'}
        </div>
      )}

      {entitlement?.entitled && entitlement.tier && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          Support is active{entitlement.tier ? ` (${entitlement.tier} tier)` : ''}. Reports are
          retained for 30 days.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="text-xs text-slate-500 mb-2">Current state</div>
          {status ? (
            <div className="space-y-3">
              <ApplianceBadge state={status.state} />
              {status.last_error && (
                <p className="text-sm text-amber-300">{status.last_error}</p>
              )}
              {status.events.length > 0 && (
                <ul className="space-y-2 text-sm text-slate-400 max-h-48 overflow-auto">
                  {status.events.slice(0, 8).map((evt) => (
                    <li key={evt.id}>
                      <span className="text-slate-500">{evt.timestamp}</span> — {evt.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Status unavailable</p>
          )}
        </Card>

        <Card>
          <label htmlFor="support-note" className="block text-xs text-slate-500 mb-2">
            What happened? (optional)
          </label>
          <textarea
            id="support-note"
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            onBlur={() => refreshPreview()}
            rows={6}
            placeholder="Describe what you expected and what you saw instead…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          onClick={submit}
          disabled={!entitlement?.entitled || submitting || polling}
        >
          {submitting || polling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {submitting ? 'Sending…' : 'Analyzing…'}
            </>
          ) : (
            <>
              <LifeBuoy className="w-4 h-4" />
              Send diagnostic report
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide preview' : 'Preview report'}
        </Button>
      </div>

      {submitError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {submitError}
        </div>
      )}

      {showPreview && preview && (
        <Card className="mb-6">
          <div className="text-xs text-slate-500 mb-2">Redacted diagnostic preview</div>
          <pre className="text-xs text-slate-300 overflow-auto max-h-96 font-mono whitespace-pre-wrap">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </Card>
      )}

      {ticket?.diagnosis && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex rounded-lg border px-3 py-1 text-sm font-medium ${VERDICT_STYLES[ticket.diagnosis.verdict]}`}
            >
              {VERDICT_LABELS[ticket.diagnosis.verdict]}
            </span>
            <span className="text-xs text-slate-500 capitalize">
              Confidence: {ticket.diagnosis.confidence}
            </span>
          </div>
          <p className="text-sm text-slate-200 mb-4">{ticket.diagnosis.summary}</p>
          {ticket.diagnosis.recommended_actions.length > 0 && (
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 mb-4">
              {ticket.diagnosis.recommended_actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          )}
          {ticket.github_issue_url && (
            <a
              href={ticket.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
            >
              View tracked issue
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </Card>
      )}

      {ticket?.status === 'failed' && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {ticket.error ?? 'Support analysis could not be completed.'}
        </div>
      )}

      {entitlement?.entitled && (
        <Card>
          <div className="text-xs text-slate-500 mb-4">Recent reports</div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No previous reports for this appliance.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {history.map((item) => (
                <li key={item.ticket_id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => loadTicket(item.ticket_id)}
                    className="w-full text-left hover:bg-slate-800/40 rounded-lg px-2 py-2 -mx-2 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-sm text-slate-200">
                        {item.summary ?? `Report ${item.ticket_id.slice(0, 8)}`}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{item.status}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{formatWhen(item.created_at)}</span>
                      {item.verdict && (
                        <span className="capitalize">{VERDICT_LABELS[item.verdict]}</span>
                      )}
                      {item.github_issue_url && (
                        <span className="text-cyan-500">Issue filed</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}