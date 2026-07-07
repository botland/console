import type {
  DiagnosticBundle,
  DiagnosisResult,
  EntitlementResponse,
  TicketCreateResponse,
  TicketListResponse,
  TicketStatusResponse,
  TicketSummary,
} from '@/lib/support/types';

type MockTicket = {
  status: string;
  bundle: DiagnosticBundle;
  diagnosis?: DiagnosisResult;
  error?: string;
  created_at: string;
  updated_at: string;
  github_issue_url?: string;
};

const tickets = new Map<string, MockTicket>();

function diagnose(bundle: DiagnosticBundle): DiagnosisResult {
  const state = bundle.health.state;
  const lastError = (bundle.health.last_error ?? '').toLowerCase();
  const exitCode = bundle.health.actual?.exit_code;

  if (state === 'READY' && !lastError) {
    return {
      verdict: 'operator_actionable',
      summary:
        'The appliance reports a healthy ready state. If you are still seeing issues, describe the symptoms in more detail.',
      confidence: 'medium',
      recommended_actions: [
        'Confirm the issue still occurs after refreshing this page.',
        'Send another report if the state changes.',
      ],
    };
  }

  if (lastError.includes('out of memory') || lastError.includes('oom')) {
    return {
      verdict: 'operator_actionable',
      summary: 'Diagnostics suggest a resource constraint on one or more nodes.',
      confidence: 'high',
      recommended_actions: [
        'Reduce model size or quantization.',
        'Disable unused deployments to free GPU memory.',
      ],
    };
  }

  if (state === 'DEGRADED' && exitCode != null && exitCode !== 0) {
    return {
      verdict: 'likely_bug',
      summary: 'A runtime process exited unexpectedly during reconciliation.',
      confidence: 'medium',
      recommended_actions: [
        'Avoid further configuration changes until analysis completes.',
        'Reboot the appliance if the issue persists.',
      ],
    };
  }

  return {
    verdict: 'insufficient_data',
    summary: 'Not enough diagnostic signal to classify this issue.',
    confidence: 'low',
    recommended_actions: ['Add a note describing what you expected versus what happened.'],
  };
}

export function mockEntitlement(applianceId: string): EntitlementResponse {
  if (applianceId.endsWith('-no-support')) {
    return {
      entitled: false,
      message: 'Support subscription required for this appliance.',
    };
  }
  return { entitled: true, tier: 'free' };
}

export async function mockSubmitBundle(bundle: DiagnosticBundle): Promise<TicketCreateResponse> {
  const entitlement = mockEntitlement(bundle.appliance_id);
  if (!entitlement.entitled) {
    throw new MockSupportError('subscription_required', entitlement.message ?? 'Not entitled', 403);
  }

  const ticketId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  tickets.set(ticketId, { status: 'queued', bundle, created_at: now, updated_at: now });

  setTimeout(() => {
    const ticket = tickets.get(ticketId);
    if (!ticket) return;
    ticket.status = 'complete';
    ticket.diagnosis = diagnose(bundle);
    ticket.updated_at = new Date().toISOString();
    if (ticket.diagnosis.verdict === 'likely_bug') {
      ticket.github_issue_url = `https://github.com/example/support/issues/mock-${ticketId}`;
    }
  }, 300);

  return { ticket_id: ticketId, status: 'queued' };
}

export function mockGetTicket(ticketId: string): TicketStatusResponse {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    throw new MockSupportError('not_found', 'Ticket not found', 404);
  }
  return {
    ticket_id: ticketId,
    status: ticket.status,
    diagnosis: ticket.diagnosis,
    error: ticket.error,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    github_issue_url: ticket.github_issue_url,
  };
}

export function mockListTickets(applianceId: string): TicketListResponse {
  const entitlement = mockEntitlement(applianceId);
  if (!entitlement.entitled) {
    throw new MockSupportError('subscription_required', entitlement.message ?? 'Not entitled', 403);
  }

  const summaries: TicketSummary[] = [];
  for (const [ticketId, ticket] of tickets.entries()) {
    if (ticket.bundle.appliance_id !== applianceId) continue;
    summaries.push({
      ticket_id: ticketId,
      status: ticket.status,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      verdict: ticket.diagnosis?.verdict,
      summary: ticket.diagnosis?.summary,
      confidence: ticket.diagnosis?.confidence,
      github_issue_url: ticket.github_issue_url,
    });
  }

  summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { appliance_id: applianceId, tickets: summaries };
}

export class MockSupportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'MockSupportError';
    this.code = code;
    this.status = status;
  }
}

export function resetMockSupport(): void {
  tickets.clear();
}