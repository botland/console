'use client';

import { useEffect, useState } from 'react';

import { Button, Card, Label, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import type { ApplianceConfig, ClusterConfig } from '@/lib/types';

export default function ClusterPage() {
  const [cluster, setCluster] = useState<ClusterConfig | null>(null);
  const [config, setConfig] = useState<ApplianceConfig | null>(null);
  const [pendingMode, setPendingMode] = useState<ClusterConfig['serving_mode'] | null>(null);

  useEffect(() => {
    Promise.all([api.getCluster(), api.getConfig()])
      .then(([cl, cfg]) => {
        setCluster(cl);
        setConfig(cfg);
      })
      .catch(console.error);
  }, []);

  const save = async (next: ClusterConfig) => {
    const saved = await api.putCluster(next);
    setCluster(saved);
    const cfg = await api.getConfig();
    setConfig(cfg);
    setPendingMode(null);
  };

  const handleModeChange = (mode: ClusterConfig['serving_mode']) => {
    if (!cluster) return;
    if (mode !== cluster.serving_mode) {
      setPendingMode(mode);
    }
  };

  const confirmModeChange = () => {
    if (!cluster || !pendingMode || !config) return;
    const enabled = config.deployments.filter((d) => d.enabled).length;
    save({
      ...cluster,
      serving_mode: pendingMode,
    });
    if (enabled > 0) {
      /* reconciler triggered server-side */
    }
  };

  if (!cluster || !config) return <div className="text-slate-500">Loading…</div>;

  const enabledCount = config.deployments.filter((d) => d.enabled).length;

  return (
    <>
      <PageHeader
        title="Cluster"
        description="Serving mode and global infrastructure settings"
      />

      <Card className="max-w-2xl space-y-6">
        <div>
          <Label>Serving mode</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => handleModeChange('ray_cluster')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                cluster.serving_mode === 'ray_cluster'
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-medium text-slate-100">Ray Serve LLM</div>
              <div className="text-xs text-slate-400 mt-1">
                Distributed cluster · cross-node TP/PP
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('litellm_standalone')}
              className={`rounded-xl border p-4 text-left transition-colors ${
                cluster.serving_mode === 'litellm_standalone'
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-medium text-slate-100">LiteLLM + vLLM</div>
              <div className="text-xs text-slate-400 mt-1">
                Head runs proxy · workers run vLLM
              </div>
            </button>
          </div>
        </div>

        {pendingMode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="text-amber-200">
              Switching to{' '}
              <strong>
                {pendingMode === 'ray_cluster' ? 'Ray Cluster' : 'LiteLLM + vLLM'}
              </strong>{' '}
              will reschedule {enabledCount} active deployment(s).
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={confirmModeChange}>Confirm switch</Button>
              <Button variant="ghost" onClick={() => setPendingMode(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          <Label>Preferred head node</Label>
          <Select
            value={cluster.preferred_head_node_id}
            onChange={(e) =>
              save({ ...cluster, preferred_head_node_id: e.target.value })
            }
          >
            {config.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.hostname} ({n.ip})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            Changing head node can disrupt cluster connectivity.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={cluster.global_defaults.autoscale_enabled}
              onChange={(e) =>
                save({
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
    </>
  );
}