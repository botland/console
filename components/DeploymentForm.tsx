'use client';

import { useEffect, useState } from 'react';

import { Button, Input, Label, Select } from '@/components/ui';
import { api } from '@/lib/api';
import type {
  ClusterConfig,
  DeploymentConfig,
  PlannerRecommendation,
  ValidationResult,
} from '@/lib/types';

function emptyDeployment(): DeploymentConfig {
  return {
    id: `dep-${Date.now()}`,
    display_name: '',
    enabled: true,
    source: { type: 'huggingface', repo_id: '' },
    user_intent: { performance_goal: 'balanced', scale: 'medium' },
    parallelism: {
      context_length: 8192,
      quantization: null,
      instances: 1,
      gpus_per_instance: 1,
      nodes_per_instance: 1,
      autoscaling: null,
    },
    status: 'reconciling',
  };
}

export function DeploymentForm({
  initial,
  cluster,
  onSave,
  onCancel,
}: {
  initial?: DeploymentConfig;
  cluster: ClusterConfig;
  onSave: (dep: DeploymentConfig) => void;
  onCancel: () => void;
}) {
  const [dep, setDep] = useState<DeploymentConfig>(initial ?? emptyDeployment());
  const [advanced, setAdvanced] = useState(!!initial);
  const [rec, setRec] = useState<PlannerRecommendation | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const standalone = cluster.serving_mode === 'standalone';

  useEffect(() => {
    const t = setTimeout(() => {
      api.recommend(dep).then(setRec).catch(() => setRec(null));
      api.validate(dep).then(setValidation).catch(() => setValidation(null));
    }, 300);
    return () => clearTimeout(t);
  }, [dep]);

  const applyRecommendation = () => {
    if (!rec) return;
    setDep((d) => ({
      ...d,
      parallelism: {
        ...d.parallelism,
        instances: rec.instances,
        gpus_per_instance: rec.gpus_per_instance,
        nodes_per_instance: rec.nodes_per_instance,
        context_length: rec.context_length,
      },
    }));
  };

  const canSave = dep.display_name.trim() && (validation?.valid ?? true);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Display name (API model ID)</Label>
          <Input
            value={dep.display_name}
            onChange={(e) => setDep({ ...dep, display_name: e.target.value })}
            placeholder="my-company-llama-8b"
          />
        </div>
        <div>
          <Label>Source type</Label>
          <Select
            value={dep.source.type}
            onChange={(e) => {
              const type = e.target.value as 'huggingface' | 'local_path';
              setDep({
                ...dep,
                source:
                  type === 'huggingface'
                    ? { type: 'huggingface', repo_id: '' }
                    : { type: 'local_path', path: '/models/' },
              });
            }}
          >
            <option value="huggingface">Hugging Face Hub</option>
            <option value="local_path">Local path / NFS / SMB</option>
          </Select>
        </div>
        <div>
          {dep.source.type === 'huggingface' ? (
            <>
              <Label>HF repo ID</Label>
              <Input
                value={dep.source.repo_id}
                onChange={(e) =>
                  setDep({
                    ...dep,
                    source: { type: 'huggingface', repo_id: e.target.value },
                  })
                }
                placeholder="meta-llama/Llama-3.1-8B-Instruct"
              />
            </>
          ) : (
            <>
              <Label>Absolute path</Label>
              <Input
                value={dep.source.path}
                onChange={(e) =>
                  setDep({
                    ...dep,
                    source: { type: 'local_path', path: e.target.value },
                  })
                }
                placeholder="/models/customer-nfs/my-model"
              />
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
        <div className="text-sm font-medium text-slate-300">Guided settings</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Performance goal</Label>
            <Select
              value={dep.user_intent.performance_goal}
              onChange={(e) =>
                setDep({
                  ...dep,
                  user_intent: {
                    ...dep.user_intent,
                    performance_goal: e.target.value as DeploymentConfig['user_intent']['performance_goal'],
                  },
                })
              }
            >
              <option value="balanced">Balanced</option>
              <option value="max_throughput">Max throughput</option>
              <option value="low_latency">Low latency</option>
              <option value="high_availability">High availability</option>
            </Select>
          </div>
          <div>
            <Label>Scale</Label>
            <Select
              value={dep.user_intent.scale}
              onChange={(e) =>
                setDep({
                  ...dep,
                  user_intent: {
                    ...dep.user_intent,
                    scale: e.target.value as DeploymentConfig['user_intent']['scale'],
                  },
                })
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="auto">Auto-scale</option>
            </Select>
          </div>
        </div>
        {rec && (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm">
            <div className="font-medium text-cyan-400 mb-1">Recommended</div>
            <div className="text-slate-400 text-xs space-y-0.5">
              <div>
                Instances: {rec.instances} · GPUs/instance: {rec.gpus_per_instance} · Nodes/instance:{' '}
                {rec.nodes_per_instance}
              </div>
              <div>Context: {rec.context_length.toLocaleString()} tokens</div>
              {rec.warnings.map((w) => (
                <div key={w} className="text-amber-400/80">
                  {w}
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-2 text-xs" onClick={applyRecommendation}>
              Apply recommendation
            </Button>
          </div>
        )}
      </div>

      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-2 text-sm">
          {validation.errors.map((e) => (
            <div key={e} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400">
              {e}
            </div>
          ))}
          {validation.warnings.map((w) => (
            <div
              key={w}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-400"
            >
              {w}
            </div>
          ))}
          {validation.inventory && (
            <div className="text-xs text-slate-500">
              Cluster: {validation.inventory.available_gpu_count} GPUs available across{' '}
              {validation.inventory.online_node_count} online node(s)
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="text-sm text-slate-400 hover:text-cyan-400"
        onClick={() => setAdvanced(!advanced)}
      >
        {advanced ? '▼' : '▶'} Advanced settings
      </button>

      {advanced && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 p-4">
          <div>
            <Label>Instances</Label>
            <Input
              type="number"
              min={1}
              value={dep.parallelism.instances}
              onChange={(e) =>
                setDep({
                  ...dep,
                  parallelism: { ...dep.parallelism, instances: +e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label>GPUs per instance {standalone && '(max per node)'}</Label>
            <Input
              type="number"
              min={1}
              value={dep.parallelism.gpus_per_instance}
              onChange={(e) =>
                setDep({
                  ...dep,
                  parallelism: { ...dep.parallelism, gpus_per_instance: +e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label>Nodes per instance {standalone && '(fixed at 1)'}</Label>
            <Input
              type="number"
              min={1}
              disabled={standalone}
              value={dep.parallelism.nodes_per_instance}
              onChange={(e) =>
                setDep({
                  ...dep,
                  parallelism: { ...dep.parallelism, nodes_per_instance: +e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label>Context length</Label>
            <Input
              type="number"
              value={dep.parallelism.context_length}
              onChange={(e) =>
                setDep({
                  ...dep,
                  parallelism: { ...dep.parallelism, context_length: +e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label>Quantization</Label>
            <Select
              value={dep.parallelism.quantization ?? ''}
              onChange={(e) =>
                setDep({
                  ...dep,
                  parallelism: {
                    ...dep.parallelism,
                    quantization: e.target.value || null,
                  },
                })
              }
            >
              <option value="">None</option>
              <option value="awq">AWQ</option>
              <option value="gptq">GPTQ</option>
              <option value="fp8">FP8</option>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={dep.enabled}
                onChange={(e) => setDep({ ...dep, enabled: e.target.checked })}
                className="rounded border-slate-600"
              />
              Enabled
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(dep)} disabled={!canSave}>
          {initial ? 'Save changes' : 'Add deployment'}
        </Button>
      </div>
    </div>
  );
}