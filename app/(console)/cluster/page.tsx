'use client';

import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Card, Label, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import type { ApplianceConfig, ClusterConfig } from '@/lib/types';

export default function ClusterPage() {
  const [cluster, setCluster] = useState<ClusterConfig | null>(null);
  const [config, setConfig] = useState<ApplianceConfig | null>(null);
  const [pendingMode, setPendingMode] = useState<ClusterConfig['serving_mode'] | null>(null);
  const [pendingHead, setPendingHead] = useState<string | null>(null);
  const [migratePreview, setMigratePreview] = useState<string | null>(null);

  const reload = () =>
    Promise.all([api.getCluster(), api.getConfig()]).then(([cl, cfg]) => {
      setCluster(cl);
      setConfig(cfg);
    });

  useEffect(() => {
    reload().catch(console.error);
  }, []);

  const saveCluster = async (next: ClusterConfig) => {
    const saved = await api.putCluster(next);
    setCluster(saved);
    await reload();
    setPendingMode(null);
  };

  const confirmHeadMigration = async () => {
    if (!pendingHead || !config) return;
    const from = config.nodes.find((n) => n.id === cluster?.head_node_id);
    const to = config.nodes.find((n) => n.id === pendingHead);
    try {
      const result = await api.migrateHead(pendingHead);
      if (result.success) {
        setMigratePreview(
          `Head is now ${to?.hostname} (${result.head.head_ip}). Open http://${result.head.head_ip}/ if this page becomes unreachable.`,
        );
        await reload();
      }
    } finally {
      setPendingHead(null);
    }
    void from;
  };

  if (!cluster || !config) return <div className="text-slate-500">Loading…</div>;

  const enabledCount = config.deployments.filter((d) => d.enabled).length;
  const pendingHeadNode = pendingHead
    ? config.nodes.find((n) => n.id === pendingHead)
    : null;
  const currentHeadNode = config.nodes.find((n) => n.id === cluster.head_node_id);

  return (
    <>
      <PageHeader
        title="Cluster"
        description="Serving topology and head node"
      />

      {migratePreview && (
        <Card className="mb-6 border-cyan-500/30 bg-cyan-500/5 text-sm text-cyan-200">
          {migratePreview}
        </Card>
      )}

      <Card className="max-w-2xl space-y-6">
        <div>
          <Label>Serving topology</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => setPendingMode('distributed')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                cluster.serving_mode === 'distributed'
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-medium text-slate-100">Distributed</div>
              <div className="text-xs text-slate-400 mt-1">
                Multi-node · instances can span nodes
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPendingMode('standalone')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                cluster.serving_mode === 'standalone'
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-medium text-slate-100">Standalone</div>
              <div className="text-xs text-slate-400 mt-1">
                Simpler layout · parallelism within one node
              </div>
            </button>
          </div>
        </div>

        {pendingMode && pendingMode !== cluster.serving_mode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="text-amber-200">
              Switching to <strong>{pendingMode}</strong> will reschedule {enabledCount}{' '}
              active deployment(s).
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => saveCluster({ ...cluster, serving_mode: pendingMode })}>
                Confirm switch
              </Button>
              <Button variant="ghost" onClick={() => setPendingMode(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          <Label>Head node</Label>
          <Select
            value={cluster.head_node_id}
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
              onChange={(e) =>
                saveCluster({
                  ...cluster,
                  global_defaults: { autoscale_enabled: e.target.checked },
                })
              }
              className="rounded border-slate-600"
            />
            Enable global autoscaling defaults
          </label>
        </div>
      </Card>

      <ConfirmDialog
        open={!!pendingHead}
        title="Migrate head node?"
        message={`Head will move from ${currentHeadNode?.hostname ?? cluster.head_node_id} to ${pendingHeadNode?.hostname ?? pendingHead}. ${enabledCount} deployment(s) will reschedule. Workers will reconnect to the new head.`}
        confirmLabel="Migrate head"
        danger
        onConfirm={confirmHeadMigration}
        onCancel={() => setPendingHead(null)}
      />
    </>
  );
}