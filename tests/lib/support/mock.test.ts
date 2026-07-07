import { describe, expect, it } from 'vitest';

import { mockEntitlement, mockGetTicket, mockSubmitBundle, resetMockSupport } from '@/lib/support/mock';
import type { DiagnosticBundle } from '@/lib/support/types';

const bundle: DiagnosticBundle = {
  bundle_version: 1,
  appliance_id: 'forge-demo-001',
  submitted_at: '2026-07-07T12:00:00Z',
  software: {
    console_version: 'dev',
    controller_version: 'dev',
    support_client_version: '1.0.0',
  },
  topology: {
    serving_mode: 'distributed',
    role: 'coordinator',
    node_count: 1,
    local_node_id: 'node-1',
  },
  health: { state: 'DEGRADED', last_error: 'CUDA out of memory' },
  events: [],
  deployments_summary: [],
  nodes_summary: [],
};

describe('support mock', () => {
  it('entitles default appliances', () => {
    expect(mockEntitlement('forge-demo-001').entitled).toBe(true);
  });

  it('denies appliances with -no-support suffix', () => {
    expect(mockEntitlement('edge-no-support').entitled).toBe(false);
  });

  it('creates and completes mock tickets', async () => {
    resetMockSupport();
    const created = await mockSubmitBundle(bundle);
    expect(created.ticket_id).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 400));
    const ticket = mockGetTicket(created.ticket_id);
    expect(ticket.status).toBe('complete');
    expect(ticket.diagnosis?.verdict).toBe('operator_actionable');
  });
});