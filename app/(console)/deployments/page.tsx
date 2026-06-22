'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { DeploymentForm } from '@/components/DeploymentForm';
import { DeploymentBadge } from '@/components/StatusBadge';
import { Button, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { ClusterConfig, DeploymentConfig } from '@/lib/types';

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentConfig[]>([]);
  const [cluster, setCluster] = useState<ClusterConfig | null>(null);
  const [editing, setEditing] = useState<DeploymentConfig | null | 'new'>(null);

  const load = useCallback(() => {
    Promise.all([api.listDeployments(), api.getCluster()])
      .then(([deps, cl]) => {
        setDeployments(deps);
        setCluster(cl);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (dep: DeploymentConfig) => {
    if (editing === 'new') {
      await api.createDeployment(dep);
    } else if (editing) {
      await api.updateDeployment(editing.id, dep);
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deployment?')) return;
    await api.deleteDeployment(id);
    load();
  };

  return (
    <>
      <PageHeader
        title="Deployments"
        description="Manage models served on your appliance"
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> Add model
          </Button>
        }
      />

      {editing && cluster && (
        <Card className="mb-6">
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            {editing === 'new' ? 'Add deployment' : `Edit ${editing.display_name}`}
          </h2>
          <DeploymentForm
            initial={editing === 'new' ? undefined : editing}
            cluster={cluster}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <div className="space-y-4">
        {deployments.map((dep) => (
          <Card key={dep.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-display font-semibold text-slate-100">
                  {dep.display_name}
                </span>
                <DeploymentBadge status={dep.status} />
                {!dep.enabled && (
                  <span className="text-xs text-slate-500">disabled</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {dep.source.type === 'huggingface'
                  ? `HF: ${dep.source.repo_id}`
                  : `Path: ${dep.source.path}`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {dep.advanced.num_replicas} replica(s) · TP {dep.advanced.tensor_parallel_size} ·{' '}
                {dep.user_intent.performance_goal.replace('_', ' ')} · {dep.user_intent.scale}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(dep)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="danger" onClick={() => handleDelete(dep.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {deployments.length === 0 && (
          <Card className="text-center text-slate-500 py-12">
            No deployments yet. Add a model to get started.
          </Card>
        )}
      </div>
    </>
  );
}