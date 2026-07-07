'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { DeploymentForm } from '@/components/DeploymentForm';
import { PageError, PageLoading } from '@/components/PageState';
import { DeploymentBadge } from '@/components/StatusBadge';
import { Button, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import {
  buildConsoleContext,
  canManageClusterDeployments,
  isDistributedWorker,
} from '@/lib/console-capabilities';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import type { DeploymentConfig, GatewayInfo, NodeConfig, OrchestrationConfig } from '@/lib/types';

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentConfig[]>([]);
  const [cluster, setCluster] = useState<OrchestrationConfig | null>(null);
  const [nodes, setNodes] = useState<NodeConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeploymentConfig | null | 'new'>(null);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.listDeployments(),
      api.getOrchestration(),
      api.getConfig(),
      api.status(),
    ])
      .then(([deps, cl, config, status]) => {
        setDeployments(deps);
        setCluster(cl);
        setNodes(config.nodes);
        setGateway(status.gateway ?? null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load deployments');
        setLoading(false);
        console.error(e);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (dep: DeploymentConfig) => {
    const validation = await api.validate(dep);
    if (!validation.valid) return;

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

  const ctx =
    gateway && cluster ? buildConsoleContext(gateway, cluster) : null;
  const canManage = ctx ? canManageClusterDeployments(ctx) : true;
  const localWorkloads = ctx ? isDistributedWorker(ctx) : false;

  if (loading && deployments.length === 0 && !error) {
    return <PageLoading />;
  }

  return (
    <>
      <PageHeader
        title="Deployments"
        description={
          localWorkloads
            ? 'Workloads assigned to this appliance in the cluster'
            : 'Models served on this appliance'
        }
        action={
          canManage ? (
            <Button onClick={() => setEditing('new')} disabled={!cluster}>
              <Plus className="w-4 h-4" /> Add model
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6">
          <PageError error={error} onRetry={load} />
        </div>
      )}

      {editing && cluster && (
        <Card className="mb-6">
          <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">
            {editing === 'new' ? 'Add deployment' : `Edit ${editing.display_name}`}
          </h2>
          <DeploymentForm
            initial={editing === 'new' ? undefined : editing}
            cluster={cluster}
            nodes={nodes}
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
                {dep.parallelism.instances} instance(s) · {dep.parallelism.gpus_per_instance}{' '}
                GPU(s)/instance · {dep.user_intent.performance_goal.replace('_', ' ')}
                {dep.placement?.targets?.[0] && (
                  <>
                    {' '}
                    ·{' '}
                    {formatNodeLabelFromNode(
                      nodes.find((n) => n.id === dep.placement!.targets[0].node_id) ?? {
                        hostname: dep.placement.targets[0].node_id,
                        ip: '',
                      },
                    )}{' '}
                    gpu{dep.placement.targets[0].gpu_indices.join(',')}
                  </>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(dep)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="danger" onClick={() => handleDelete(dep.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
        {!error && deployments.length === 0 && (
          <Card className="text-center text-slate-500 py-12">
            No deployments yet. Add a model to get started.
          </Card>
        )}
      </div>
    </>
  );
}