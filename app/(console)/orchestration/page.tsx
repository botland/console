'use client';

import { useCallback, useEffect, useState } from 'react';

import { BlockingOverlay } from '@/components/BlockingOverlay';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageState } from '@/components/PageState';
import { Card, Label, PageHeader, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  describeOrchestrationSwitch,
  waitForOrchestrationSettle,
  type OrchestrationSwitchKind,
} from '@/lib/orchestration-switch';
import {
  normalizeClusterPatch,
  resolveComputeBackend,
  toOrchestrationPutPayload,
} from '@/lib/orchestration';
import {
  buildConsoleContext,
  canDetachFromCluster,
  canEditOrchestrationTopology,
} from '@/lib/console-capabilities';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import type {
  ApplianceConfig,
  ComputeBackend,
  FederationLayout,
  GatewayInfo,
  OrchestrationConfig,
  ServingMode,
} from '@/lib/types';

type PendingSwitch =
  | { kind: 'serving_mode'; to: ServingMode }
  | { kind: 'compute_backend'; to: ComputeBackend }
  | { kind: 'federation_layout'; to: FederationLayout }
  | { kind: 'head_gpu'; to: boolean };

export default function OrchestrationPage() {
  const [cluster, setCluster] = useState<OrchestrationConfig | null>(null);
  const [config, setConfig] = useState<ApplianceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [pendingHead, setPendingHead] = useState<string | null>(null);
  const [migratePreview, setMigratePreview] = useState<string | null>(null);
  const [switching, setSwitching] = useState<{ title: string; detail?: string } | null>(null);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);
  const [detachOpen, setDetachOpen] = useState(false);

  const enabledDeployments = config?.deployments.filter((d) => d.enabled).length ?? 0;
  const ctx =
    gateway && cluster ? buildConsoleContext(gateway, cluster) : null;
  const workerDetach = ctx ? canDetachFromCluster(ctx) : false;
  const showTopology = ctx ? canEditOrchestrationTopology(ctx) : true;

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([api.getOrchestration(), api.getConfig(), api.status()])
      .then(([cl, cfg, status]) => {
        setCluster(cl);
        setConfig(cfg);
        setGateway(status.gateway ?? null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load orchestration settings');
        setLoading(false);
        console.error(e);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const applyOrchestrationChange = async (
    next: OrchestrationConfig,
    overlay: { title: string; detail?: string },
  ) => {
    setSwitching(overlay);
    setError(null);
    try {
      const baseline = await api.status();
      const baselineEventIds = baseline.events.map((evt) => evt.id);
      const putResult = await api.putOrchestration(toOrchestrationPutPayload(next));
      const result = await waitForOrchestrationSettle(
        () =>
          api.status().then((status) => ({
            state: status.state,
            last_reconcile_ts: status.last_reconcile_ts,
            events: status.events,
          })),
        {
          baselineReconcileTs: baseline.last_reconcile_ts,
          baselineEventIds,
          reconcileSeq: putResult.reconcile_seq,
        },
      );
      await reload();
      if (!result.settled) {
        setError(
          `Switch is still in progress (state: ${result.state}). Check Overview — reconciliation may take several minutes.`,
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update orchestration');
      console.error(e);
    } finally {
      setSwitching(null);
    }
  };

  const confirmPendingSwitch = () => {
    if (!cluster || !pendingSwitch) return;

    const request = pendingSwitch;
    setPendingSwitch(null);

    let next = cluster;
    let kind: OrchestrationSwitchKind = request.kind;
    let from = '';
    let to = '';

    switch (request.kind) {
      case 'serving_mode':
        from = cluster.serving_mode;
        to = request.to;
        next = normalizeClusterPatch(cluster, { serving_mode: request.to });
        break;
      case 'compute_backend':
        from = resolveComputeBackend(cluster);
        to = request.to;
        next = normalizeClusterPatch(cluster, {
          compute_backend: request.to,
          federation_layout:
            request.to === 'federation'
              ? cluster.federation_layout ?? 'replicated'
              : undefined,
        });
        break;
      case 'federation_layout':
        from = cluster.federation_layout ?? 'replicated';
        to = request.to;
        next = normalizeClusterPatch(cluster, {
          compute_backend: 'federation',
          federation_layout: request.to,
        });
        break;
      case 'head_gpu':
        from = String(cluster.head_gpu ?? true);
        to = String(request.to);
        next = normalizeClusterPatch(cluster, { head_gpu: request.to });
        break;
    }

    const { progress } = describeOrchestrationSwitch(kind, from, to, enabledDeployments);
    void applyOrchestrationChange(next, {
      title: progress,
      detail:
        'Stopping current inference, applying the new topology, and waiting for the appliance to become ready. This may take several minutes.',
    });
  };

  const confirmHeadMigration = () => {
    if (!pendingHead || !config) return;
    const targetId = pendingHead;
    const to = config.nodes.find((n) => n.id === targetId);
    setPendingHead(null);
    setSwitching({
      title: 'Migrating head node…',
      detail: 'Moving the control plane and reconnecting workers. This may take a minute.',
    });
    void (async () => {
      try {
        const result = await api.migrateHead(targetId);
        if (result.success) {
          setMigratePreview(
            `Head is now ${formatNodeLabelFromNode(
              to ?? { hostname: '', ip: result.head.head_ip },
            )}. Open http://${result.head.head_ip}/ if this page becomes unreachable.`,
          );
          await reload();
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Head migration failed');
        console.error(e);
      } finally {
        setSwitching(null);
      }
    })();
  };

  const pendingCopy =
    cluster && pendingSwitch
      ? (() => {
          switch (pendingSwitch.kind) {
            case 'serving_mode':
              return describeOrchestrationSwitch(
                'serving_mode',
                cluster.serving_mode,
                pendingSwitch.to,
                enabledDeployments,
              );
            case 'compute_backend':
              return describeOrchestrationSwitch(
                'compute_backend',
                resolveComputeBackend(cluster),
                pendingSwitch.to,
                enabledDeployments,
              );
            case 'federation_layout':
              return describeOrchestrationSwitch(
                'federation_layout',
                cluster.federation_layout ?? 'replicated',
                pendingSwitch.to,
                enabledDeployments,
              );
            case 'head_gpu':
              return describeOrchestrationSwitch(
                'head_gpu',
                String(cluster.head_gpu ?? true),
                String(pendingSwitch.to),
                enabledDeployments,
              );
          }
        })()
      : null;

  const confirmDetach = async () => {
    setDetachOpen(false);
    setSwitching({
      title: 'Detaching from cluster…',
      detail: 'Leaving the cluster and restarting as a standalone appliance.',
    });
    setError(null);
    try {
      const baseline = await api.status();
      const baselineEventIds = baseline.events.map((evt) => evt.id);
      const putResult = await api.detachFromCluster();
      const result = await waitForOrchestrationSettle(
        () =>
          api.status().then((status) => ({
            state: status.state,
            last_reconcile_ts: status.last_reconcile_ts,
            events: status.events,
          })),
        {
          baselineReconcileTs: baseline.last_reconcile_ts,
          baselineEventIds,
          reconcileSeq: putResult.reconcile_seq,
        },
      );
      await reload();
      if (!result.settled) {
        setError(
          `Detach is still in progress (state: ${result.state}). Check Overview for status.`,
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to detach from cluster');
      console.error(e);
    } finally {
      setSwitching(null);
    }
  };

  const controlsDisabled = !!switching;

  return (
    <PageState loading={loading && !switching} error={error} onRetry={reload}>
      {switching && (
        <BlockingOverlay title={switching.title} detail={switching.detail} />
      )}
      {cluster && config && (
        <>
          <PageHeader
            title="Orchestration"
            description={
              workerDetach
                ? 'Leave the distributed cluster and run this appliance standalone'
                : cluster.serving_mode === 'standalone'
                  ? 'Runtime settings for this standalone appliance'
                  : 'Topology, inference backend, and coordinator head'
            }
          />

          {workerDetach && (
            <Card className="max-w-2xl space-y-4 mb-6">
              <h2 className="font-display font-semibold text-slate-100">Detach and run standalone</h2>
              <ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">
                <li>Inference on this appliance will restart.</li>
                <li>This node will leave the cluster registry on the coordinator.</li>
                <li>
                  The coordinator cannot migrate head role to this node afterward unless you re-join
                  from the Nodes page.
                </li>
                <li>Manage the remaining cluster from the coordinator console (Nodes → Open console).</li>
              </ul>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => setDetachOpen(true)}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Detach from cluster
              </button>
            </Card>
          )}

          {migratePreview && (
            <Card className="mb-6 border-cyan-500/30 bg-cyan-500/5 text-sm text-cyan-200">
              {migratePreview}
            </Card>
          )}

          {showTopology && (
          <Card className={`max-w-2xl space-y-6 ${controlsDisabled ? 'pointer-events-none opacity-50' : ''}`}>
            <div>
              <Label>Serving topology</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {(['distributed', 'standalone'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={controlsDisabled || cluster.serving_mode === mode}
                    onClick={() => setPendingSwitch({ kind: 'serving_mode', to: mode })}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      cluster.serving_mode === mode
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    } ${controlsDisabled ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="font-medium text-slate-100">
                      {mode === 'distributed' ? 'Distributed' : 'Standalone'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {mode === 'distributed'
                        ? 'Multi-node · instances can span nodes'
                        : 'Simpler layout · parallelism within one node'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Inference backend</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {(
                  [
                    ['federation', 'Federated inference', 'Assignment-driven workers'],
                    ['cluster', 'Clustered inference', 'Ray placement across nodes'],
                  ] as const
                ).map(([value, title, hint]) => {
                  const clusterBackendDisabled =
                    value === 'cluster' && cluster.serving_mode === 'standalone';
                  const activeBackend = resolveComputeBackend(cluster);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={
                        controlsDisabled || clusterBackendDisabled || activeBackend === value
                      }
                      onClick={() =>
                        setPendingSwitch({ kind: 'compute_backend', to: value })
                      }
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        activeBackend === value
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      } ${clusterBackendDisabled || controlsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-medium text-slate-100">{title}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {clusterBackendDisabled ? 'Requires distributed topology' : hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {cluster.serving_mode === 'distributed' &&
              resolveComputeBackend(cluster) === 'federation' && (
                <div>
                  <Label>Federated inference layout</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {(
                      [
                        ['replicated', 'Replicated (throughput)', 'Same model across nodes'],
                        ['diverse', 'Diverse (multi-model)', 'Multiple enabled deployments'],
                      ] as const
                    ).map(([value, title, hint]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={
                          controlsDisabled ||
                          (cluster.federation_layout ?? 'replicated') === value
                        }
                        onClick={() =>
                          setPendingSwitch({ kind: 'federation_layout', to: value })
                        }
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          (cluster.federation_layout ?? 'replicated') === value
                            ? 'border-cyan-500/40 bg-cyan-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        } ${controlsDisabled ? 'cursor-not-allowed' : ''}`}
                      >
                        <div className="font-medium text-slate-100">{title}</div>
                        <div className="text-xs text-slate-400 mt-1">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={cluster.head_gpu ?? true}
                  disabled={controlsDisabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next !== (cluster.head_gpu ?? true)) {
                      setPendingSwitch({ kind: 'head_gpu', to: next });
                    }
                  }}
                  className="rounded border-slate-600"
                />
                Coordinator runs inference (head GPU)
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Disable when workers alone should serve models in distributed mode.
              </p>
            </div>

            <div>
              <Label>Head node</Label>
              <Select
                value={cluster.head_node_id}
                disabled={controlsDisabled}
                onChange={(e) => {
                  if (e.target.value !== cluster.head_node_id) {
                    setPendingHead(e.target.value);
                  }
                }}
              >
                {config.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.hostname} ({n.ip}){n.status !== 'online' ? ' — offline' : ''}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                Epoch {cluster.head_epoch}. Moving the head migrates the control plane and reconnects
                all nodes.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={cluster.global_defaults.autoscale_enabled}
                  disabled={controlsDisabled}
                  onChange={async (e) => {
                    try {
                      await api.putOrchestration(
                        toOrchestrationPutPayload(
                          normalizeClusterPatch(cluster, {
                            global_defaults: { autoscale_enabled: e.target.checked },
                          }),
                        ),
                      );
                      await reload();
                    } catch (err) {
                      setError(
                        err instanceof ApiError ? err.message : 'Failed to update autoscaling',
                      );
                    }
                  }}
                  className="rounded border-slate-600"
                />
                Enable global autoscaling defaults
              </label>
            </div>
          </Card>
          )}

          <ConfirmDialog
            open={detachOpen}
            title="Detach from cluster?"
            message="This appliance will leave the cluster and run standalone. The coordinator cannot migrate head to this node afterward unless you join again."
            confirmLabel="Detach"
            danger
            onConfirm={confirmDetach}
            onCancel={() => setDetachOpen(false)}
          />

          <ConfirmDialog
            open={!!pendingSwitch && !!pendingCopy}
            title={pendingCopy?.title ?? 'Apply change?'}
            message={pendingCopy?.message ?? ''}
            confirmLabel="Confirm switch"
            danger
            onConfirm={confirmPendingSwitch}
            onCancel={() => setPendingSwitch(null)}
          />

          <ConfirmDialog
            open={!!pendingHead}
            title="Migrate head node?"
            message={`Head will move from ${formatNodeLabelFromNode(config.nodes.find((n) => n.id === cluster.head_node_id) ?? { hostname: cluster.head_node_id, ip: '' })} to ${formatNodeLabelFromNode(config.nodes.find((n) => n.id === pendingHead) ?? { hostname: pendingHead ?? '', ip: '' })}. ${enabledDeployments} deployment(s) will reschedule. Workers will reconnect to the new head.`}
            confirmLabel="Migrate head"
            danger
            onConfirm={confirmHeadMigration}
            onCancel={() => setPendingHead(null)}
          />
        </>
      )}
    </PageState>
  );
}