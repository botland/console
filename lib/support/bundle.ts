import {
  getConfig,
  getControllerVersion,
  getGatewayStatus,
  getLocalNodeId,
  getStatus,
  getSupportDiagnostics,
  isHeadCoordinator,
  listDeployments,
  listNodesWithAgents,
} from '@/lib/runtime';
import { roleLabel, buildConsoleContext } from '@/lib/console-capabilities';
import type { DiagnosticBundle } from '@/lib/support/types';
import { scrubSecrets, truncateLogTail } from '@/lib/support/redact';

const SUPPORT_CLIENT_VERSION = '1.0.0';

function consoleVersion(): string {
  return process.env.APPLIANCE_CONSOLE_VERSION ?? process.env.npm_package_version ?? 'dev';
}

export async function buildDiagnosticBundle(userNote = ''): Promise<DiagnosticBundle> {
  const [status, config, gateway, nodes, deployments, localNodeId, isHead, diagnostics, controllerVersion] =
    await Promise.all([
      getStatus(),
      getConfig().catch(() => null),
      getGatewayStatus().catch(() => null),
      listNodesWithAgents().catch(() => []),
      listDeployments().catch(() => []),
      getLocalNodeId(),
      isHeadCoordinator(),
      getSupportDiagnostics().catch(() => null),
      getControllerVersion().catch(() => 'unknown'),
    ]);

  if (!config?.appliance_id) {
    throw new Error('Appliance ID is unavailable');
  }

  const ctx =
    gateway && config.cluster
      ? buildConsoleContext(gateway, config.cluster)
      : null;

  const bundle: DiagnosticBundle = {
    bundle_version: 1,
    appliance_id: config.appliance_id,
    submitted_at: new Date().toISOString(),
    software: {
      console_version: consoleVersion(),
      controller_version: diagnostics?.version ?? controllerVersion,
      support_client_version: SUPPORT_CLIENT_VERSION,
    },
    topology: {
      serving_mode: config.cluster.serving_mode,
      role: ctx ? roleLabel(ctx) : isHead ? 'coordinator' : 'worker',
      node_count: config.nodes.length,
      local_node_id: localNodeId,
    },
    health: {
      state: status.state,
      last_error: status.last_error,
      actual: status.actual,
    },
    events: status.events.slice(-50),
    deployments_summary: deployments.map((dep) => ({
      id: dep.id,
      display_name: dep.display_name,
      enabled: dep.enabled,
      status: dep.status,
    })),
    nodes_summary: nodes.map((node) => ({
      id: node.id,
      hostname: node.hostname,
      status: node.status,
      is_head: node.is_head,
      gpu_count: node.gpus.length,
    })),
    user_note: userNote.trim(),
    attachments: {},
  };

  const attachments: Record<string, unknown> = {};
  if (status.actual?.log_snippet) {
    attachments.runtime_log_snippet = status.actual.log_snippet;
  }
  if (diagnostics?.controller_logs_tail) {
    attachments.controller_logs_tail = truncateLogTail(diagnostics.controller_logs_tail);
  }
  if (diagnostics?.container_logs_tail) {
    attachments.container_logs_tail = Object.fromEntries(
      Object.entries(diagnostics.container_logs_tail).map(([key, value]) => [
        key,
        truncateLogTail(value),
      ]),
    );
  }
  if (diagnostics?.host) {
    attachments.host = diagnostics.host;
  }
  if (Object.keys(attachments).length > 0) {
    bundle.attachments = attachments;
  }

  return scrubSecrets(bundle);
}