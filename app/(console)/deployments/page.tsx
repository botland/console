'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Power, PowerOff, Sparkles, Trash2 } from 'lucide-react';

import { DeploymentForm } from '@/components/DeploymentForm';
import {
  findQualificationForRepo,
  QualificationDialog,
  type QualificationView,
  VERDICT_LABELS,
  VERDICT_STYLES,
} from '@/components/ModelQualificationPanel';
import { PageError, PageLoading } from '@/components/PageState';
import { DeploymentBadge } from '@/components/StatusBadge';
import { Button, Card, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApplianceStatus } from '@/lib/status-context';
import {
  buildConsoleContext,
  canManageClusterDeployments,
  isDistributedWorker,
} from '@/lib/console-capabilities';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import {
  pollQualifyJob,
  QualifyPollTimeoutError,
} from '@/lib/support/qualify-polling';
import type { StoredQualification } from '@/lib/support/qualify-types';
import type { DeploymentConfig, NodeConfig, OrchestrationConfig } from '@/lib/types';

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<DeploymentConfig[]>([]);
  const [cluster, setCluster] = useState<OrchestrationConfig | null>(null);
  const [nodes, setNodes] = useState<NodeConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeploymentConfig | null | 'new'>(null);
  const [qualifications, setQualifications] = useState<StoredQualification[]>([]);
  /** Deployment id currently running qualification (disables all Qualify buttons). */
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [qualifyDialogOpen, setQualifyDialogOpen] = useState(false);
  const [qualifyView, setQualifyView] = useState<QualificationView | null>(null);
  const [qualifyDialogError, setQualifyDialogError] = useState<string | null>(null);
  const [qualifyDialogTitle, setQualifyDialogTitle] = useState('Model qualification');
  const [requalifyTarget, setRequalifyTarget] = useState<DeploymentConfig | null>(null);
  const { status: applianceStatus } = useApplianceStatus();
  const gateway = applianceStatus?.gateway ?? null;

  const loadQualifications = useCallback(async () => {
    try {
      const list = await api.listQualifications();
      setQualifications(list.qualifications);
      return list.qualifications;
    } catch {
      setQualifications([]);
      return [] as StoredQualification[];
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.listDeployments(),
      api.getOrchestration(),
      api.getConfig(),
      loadQualifications(),
    ])
      .then(([deps, cl, config]) => {
        setDeployments(deps);
        setCluster(cl);
        setNodes(config.nodes);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load deployments');
        setLoading(false);
        console.error(e);
      });
  }, [loadQualifications]);

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

  const handleToggle = async (dep: DeploymentConfig) => {
    const next = { ...dep, enabled: !dep.enabled };
    if (next.enabled) {
      const validation = await api.validate(next);
      if (!validation.valid) {
        setError(validation.errors.join(' '));
        return;
      }
    }
    setError(null);
    await api.updateDeployment(dep.id, next);
    load();
  };

  const runQualify = async (dep: DeploymentConfig, refresh = false) => {
    if (dep.source.type !== 'huggingface') {
      setError('Qualification is only available for Hugging Face models.');
      return;
    }
    if (qualifyingId) return;

    const modelRef = dep.source.repo_id.trim();
    setQualifyingId(dep.id);
    setQualifyDialogError(null);
    setError(null);
    setRequalifyTarget(dep);
    setQualifyDialogTitle(refresh ? 'Re-qualifying model' : 'Model qualification');
    setQualifyDialogOpen(true);
    if (!refresh) {
      setQualifyView(null);
    }

    try {
      const created = await api.qualifyHf({
        model_ref: modelRef,
        revision: 'main',
        refresh,
      });

      const applyResult = (
        qualification: NonNullable<typeof created.qualification>,
        modelKey: string | null | undefined,
        warnings: string[] | undefined,
        cached?: boolean,
      ) => {
        setQualifyView({
          qualification,
          modelKey,
          warnings,
          cached,
          modelRef,
        });
        setQualifyDialogTitle('Model qualification');
      };

      if (created.cached && created.qualification) {
        applyResult(created.qualification, created.model_key, created.warnings, true);
        await loadQualifications();
        return;
      }
      if (created.status === 'complete' && created.qualification) {
        applyResult(
          created.qualification,
          created.model_key,
          created.warnings,
          Boolean(created.cached),
        );
        await loadQualifications();
        return;
      }

      const job = await pollQualifyJob(api.qualifyJob, created.job_id);
      if (job.status === 'failed') {
        setQualifyDialogError(job.error || 'Qualification failed');
        setQualifyView(null);
        return;
      }
      if (job.qualification) {
        applyResult(job.qualification, job.model_key, job.warnings, false);
      }
      await loadQualifications();
    } catch (e) {
      const message =
        e instanceof QualifyPollTimeoutError
          ? e.message
          : e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Failed to qualify model';
      setQualifyDialogError(message);
      if (!refresh) setQualifyView(null);
    } finally {
      setQualifyingId(null);
    }
  };

  const handleQualifyClick = (dep: DeploymentConfig) => {
    if (dep.source.type !== 'huggingface') return;
    if (qualifyingId) return;

    const stored = findQualificationForRepo(qualifications, dep.source.repo_id);
    if (stored) {
      setRequalifyTarget(dep);
      setQualifyDialogError(null);
      setQualifyDialogTitle('Model qualification');
      setQualifyView({
        qualification: stored.qualification,
        modelKey: stored.model_key,
        warnings: stored.warnings,
        cached: true,
        modelRef: stored.model_ref,
      });
      setQualifyDialogOpen(true);
      return;
    }

    void runQualify(dep, false);
  };

  const closeQualifyDialog = () => {
    if (qualifyingId) return;
    setQualifyDialogOpen(false);
    setQualifyView(null);
    setQualifyDialogError(null);
    setRequalifyTarget(null);
  };

  const ctx =
    gateway && cluster ? buildConsoleContext(gateway, cluster) : null;
  const canManage = ctx ? canManageClusterDeployments(ctx) : true;
  const localWorkloads = ctx ? isDistributedWorker(ctx) : false;
  const qualifyBusy = qualifyingId !== null;

  if (loading && deployments.length === 0 && !error) {
    return <PageLoading />;
  }

  return (
    <>
      <PageHeader
        title="Models"
        description={
          localWorkloads
            ? 'Workloads assigned to this appliance in the cluster'
            : 'Inference models on this appliance (API: deployments)'
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
        {deployments
          .filter((dep) => editing === 'new' || editing === null || dep.id !== editing.id)
          .map((dep) => {
            const placementTarget = dep.placement?.targets?.[0];
            const isHf = dep.source.type === 'huggingface';
            const stored =
              dep.source.type === 'huggingface'
                ? findQualificationForRepo(qualifications, dep.source.repo_id)
                : null;
            const isThisQualifying = qualifyingId === dep.id;
            return (
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
                {stored && (
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium ${VERDICT_STYLES[stored.qualification.verdict]}`}
                  >
                    {VERDICT_LABELS[stored.qualification.verdict]}
                  </span>
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
                {placementTarget && (
                  <>
                    {' '}
                    ·{' '}
                    {formatNodeLabelFromNode(
                      nodes.find((n) => n.id === placementTarget.node_id) ?? {
                        hostname: placementTarget.node_id,
                        ip: '',
                      },
                    )}{' '}
                    gpu{placementTarget.gpu_indices.join(',')}
                  </>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleQualifyClick(dep)}
                  disabled={qualifyBusy || !isHf}
                  title={
                    !isHf
                      ? 'Qualification is only available for Hugging Face models'
                      : stored
                        ? 'View qualification'
                        : qualifyBusy
                          ? 'A qualification is already in progress'
                          : 'Qualify model'
                  }
                  aria-label={
                    stored ? 'View model qualification' : 'Qualify model'
                  }
                >
                  {isThisQualifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleToggle(dep)}
                  title={dep.enabled ? 'Disable deployment' : 'Enable deployment'}
                  aria-label={dep.enabled ? 'Disable deployment' : 'Enable deployment'}
                >
                  {dep.enabled ? (
                    <PowerOff className="w-4 h-4" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(dep)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="danger" onClick={() => handleDelete(dep.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
            );
          })}
        {!error &&
          deployments.filter(
            (dep) => editing === 'new' || editing === null || dep.id !== editing.id,
          ).length === 0 &&
          editing !== 'new' && (
          <Card className="text-center text-slate-500 py-12">
            No deployments yet. Add a model to get started.
          </Card>
        )}
      </div>

      <QualificationDialog
        open={qualifyDialogOpen}
        title={qualifyDialogTitle}
        view={qualifyView}
        busy={qualifyBusy}
        error={qualifyDialogError}
        onClose={closeQualifyDialog}
        onRequalify={
          requalifyTarget
            ? () => {
                void runQualify(requalifyTarget, true);
              }
            : undefined
        }
      />
    </>
  );
}
