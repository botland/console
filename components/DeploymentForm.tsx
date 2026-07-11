'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, FieldLabel, Input, Label, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { DEPLOYMENT_VOCAB } from '@/lib/deployment-vocabulary';
import {
  availableGpus,
  resolveDeploymentFormMode,
  resolvePlacementMode,
} from '@/lib/deployment-ui';
import type {
  DeploymentConfig,
  DeploymentPlacementTarget,
  NodeConfig,
  OrchestrationConfig,
  PlannerRecommendation,
  ValidationResult,
} from '@/lib/types';

function emptyDeployment(_nodes: NodeConfig[]): DeploymentConfig {
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
      gpu_utilization: 0.85,
      autoscaling: null,
    },
    status: 'reconciling',
  };
}

function ensurePlacementTargets(
  dep: DeploymentConfig,
  nodes: NodeConfig[],
): DeploymentConfig['placement'] {
  const instances = dep.parallelism.instances;
  const gpusPer = dep.parallelism.gpus_per_instance;
  const existing = dep.placement?.targets ?? [];
  const targets: DeploymentPlacementTarget[] = [];

  for (let index = 0; index < instances; index += 1) {
    const prior = existing[index];
    const node =
      nodes.find((item) => item.id === prior?.node_id) ??
      nodes.find((item) => item.status === 'online') ??
      nodes[0];
    const allowed = node ? availableGpus(node) : [];
    let gpuIndices = (prior?.gpu_indices ?? []).filter((gpu) => allowed.includes(gpu));
    if (gpuIndices.length !== gpusPer) {
      gpuIndices = allowed.slice(0, gpusPer);
    }
    targets.push({
      node_id: node?.id ?? prior?.node_id ?? '',
      gpu_indices: gpuIndices,
    });
  }

  return { targets };
}

export function DeploymentForm({
  initial,
  cluster,
  nodes,
  onSave,
  onCancel,
}: {
  initial?: DeploymentConfig;
  cluster: OrchestrationConfig;
  nodes: NodeConfig[];
  onSave: (dep: DeploymentConfig) => void;
  onCancel: () => void;
}) {
  const [dep, setDep] = useState<DeploymentConfig>(() => {
    const base = initial ?? emptyDeployment(nodes);
    const mode = resolveDeploymentFormMode(cluster, base);
    if (mode.showPlacement) {
      return {
        ...base,
        placement: {
          mode: 'manual',
          targets: ensurePlacementTargets(base, nodes)?.targets ?? [],
        },
      };
    }
    if (mode.canChoosePlacement) {
      return { ...base, placement: { mode: 'auto' } };
    }
    return base;
  });
  const [advanced, setAdvanced] = useState(!!initial);
  const [rec, setRec] = useState<PlannerRecommendation | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const mode = useMemo(() => resolveDeploymentFormMode(cluster, dep), [cluster, dep]);
  const placementMode = resolvePlacementMode(dep.placement, cluster);

  useEffect(() => {
    const t = setTimeout(() => {
      api.recommend(dep).then(setRec).catch(() => setRec(null));
      api.validate(dep).then(setValidation).catch(() => setValidation(null));
    }, 300);
    return () => clearTimeout(t);
  }, [dep]);

  const applyRecommendation = () => {
    if (!rec) return;
    setDep((current) => {
      const next: DeploymentConfig = {
        ...current,
        parallelism: {
          ...current.parallelism,
          instances: rec.instances,
          gpus_per_instance: rec.gpus_per_instance,
          nodes_per_instance: mode.showNodesPerInstance ? rec.nodes_per_instance : 1,
          context_length: rec.context_length,
        },
      };
      if (mode.showPlacement) {
        next.placement = {
          mode: 'manual',
          targets: ensurePlacementTargets(next, nodes)?.targets ?? [],
        };
      }
      return next;
    });
  };

  const updatePlacementMode = (nextMode: 'auto' | 'manual') => {
    setDep((current) => {
      if (nextMode === 'manual') {
        return {
          ...current,
          placement: {
            mode: 'manual',
            targets: ensurePlacementTargets(current, nodes)?.targets ?? [],
          },
        };
      }
      return { ...current, placement: { mode: 'auto' } };
    });
  };

  const updateParallelism = (patch: Partial<DeploymentConfig['parallelism']>) => {
    setDep((current) => {
      const parallelism = {
        ...current.parallelism,
        ...patch,
        nodes_per_instance: mode.showNodesPerInstance
          ? (patch.nodes_per_instance ?? current.parallelism.nodes_per_instance)
          : 1,
      };
      const next: DeploymentConfig = { ...current, parallelism };
      if (mode.showPlacement) {
        next.placement = {
          mode: 'manual',
          targets: ensurePlacementTargets(next, nodes)?.targets ?? [],
        };
      }
      return next;
    });
  };

  const updateScale = (scale: DeploymentConfig['user_intent']['scale']) => {
    setDep((current) => {
      const next: DeploymentConfig = {
        ...current,
        user_intent: { ...current.user_intent, scale },
      };
      if (scale === 'auto') {
        next.parallelism = { ...next.parallelism, instances: 1 };
      }
      if (mode.showPlacement) {
        next.placement = {
          mode: 'manual',
          targets: ensurePlacementTargets(next, nodes)?.targets ?? [],
        };
      }
      return next;
    });
  };

  const instancesAuto = dep.user_intent.scale === 'auto';

  const updatePlacementTarget = (
    index: number,
    patch: Partial<DeploymentPlacementTarget>,
  ) => {
    setDep((current) => {
      const targets = [...(current.placement?.targets ?? [])];
      const existing = targets[index] ?? { node_id: '', gpu_indices: [] };
      const nodeId = patch.node_id ?? existing.node_id;
      const node = nodes.find((item) => item.id === nodeId);
      let gpuIndices = patch.gpu_indices ?? existing.gpu_indices;
      if (patch.node_id && node) {
        const allowed = availableGpus(node);
        gpuIndices = gpuIndices.filter((gpu) => allowed.includes(gpu));
        if (gpuIndices.length < current.parallelism.gpus_per_instance) {
          gpuIndices = allowed.slice(0, current.parallelism.gpus_per_instance);
        }
      }
      targets[index] = { node_id: nodeId, gpu_indices: gpuIndices };
      return { ...current, placement: { targets } };
    });
  };

  const togglePlacementGpu = (index: number, gpuIndex: number) => {
    setDep((current) => {
      const targets = [...(current.placement?.targets ?? [])];
      const target = targets[index];
      if (!target) return current;
      const selected = new Set(target.gpu_indices);
      if (selected.has(gpuIndex)) {
        selected.delete(gpuIndex);
      } else if (selected.size < current.parallelism.gpus_per_instance) {
        selected.add(gpuIndex);
      }
      targets[index] = {
        ...target,
        gpu_indices: [...selected].sort((a, b) => a - b),
      };
      return { ...current, placement: { targets } };
    });
  };

  const handleSave = () => {
    const payload: DeploymentConfig = {
      ...dep,
      parallelism: {
        ...dep.parallelism,
        nodes_per_instance: mode.showNodesPerInstance ? dep.parallelism.nodes_per_instance : 1,
      },
    };
    if (mode.canChoosePlacement) {
      if (mode.showPlacement) {
        payload.placement = {
          mode: 'manual',
          targets: dep.placement?.targets ?? [],
        };
      } else {
        payload.placement = { mode: 'auto' };
      }
    } else {
      delete payload.placement;
    }
    onSave(payload);
  };

  const canSave = dep.display_name.trim() && (validation?.valid ?? true);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <FieldLabel label="Display name (API model ID)" hint={DEPLOYMENT_VOCAB.displayName}>
          <Input
            value={dep.display_name}
            onChange={(e) => setDep({ ...dep, display_name: e.target.value })}
            placeholder="my-company-llama-8b"
          />
          </FieldLabel>
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
            <FieldLabel label="Scale" hint={DEPLOYMENT_VOCAB.scalePreset}>
            <Select
              value={dep.user_intent.scale}
              onChange={(e) =>
                updateScale(e.target.value as DeploymentConfig['user_intent']['scale'])
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="auto">Auto (match cluster GPU slots)</option>
            </Select>
            </FieldLabel>
          </div>
        </div>
        {rec && (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm">
            <div className="font-medium text-cyan-400 mb-1">Recommended</div>
            <div className="text-slate-400 text-xs space-y-0.5">
              <div>
                Instances: {rec.instances} · GPUs/instance: {rec.gpus_per_instance}
                {mode.showNodesPerInstance && (
                  <> · Nodes/instance: {rec.nodes_per_instance}</>
                )}
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

      {mode.canChoosePlacement && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-4">
          <div>
            <FieldLabel
              label="Placement"
              hint={
                placementMode === 'auto'
                  ? DEPLOYMENT_VOCAB.placementAuto
                  : DEPLOYMENT_VOCAB.placementManual
              }
            >
              <Select
                value={placementMode}
                onChange={(e) => updatePlacementMode(e.target.value as 'auto' | 'manual')}
              >
                <option value="auto">Auto (cluster planner)</option>
                <option value="manual">Manual (choose node &amp; GPU)</option>
              </Select>
            </FieldLabel>
          </div>
          {placementMode === 'manual' && (
            <p className="text-xs text-slate-500">
              Choose the node and GPU for each replica — including nodes that are offline or not yet
              joined. Multiple models can share a GPU when their combined utilization stays at or
              below 1.0.
            </p>
          )}
        </div>
      )}

      {mode.showPlacement && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-slate-300">Instance targets</div>
          </div>
          {(dep.placement?.targets ?? []).map((target, index) => {
            const node = nodes.find((item) => item.id === target.node_id);
            const gpus = node ? availableGpus(node) : [];
            return (
              <div
                key={`placement-${index}`}
                className="rounded-lg border border-slate-800 p-3 space-y-3"
              >
                <div className="text-xs font-medium text-slate-400">
                  Instance {index + 1}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Node</Label>
                    <Select
                      value={target.node_id}
                      onChange={(e) =>
                        updatePlacementTarget(index, { node_id: e.target.value })
                      }
                    >
                      {nodes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.hostname} ({item.ip})
                          {item.status !== 'online' ? ` — ${item.status}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>
                      GPUs ({target.gpu_indices.length}/{dep.parallelism.gpus_per_instance})
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {gpus.length === 0 ? (
                        <span className="text-xs text-slate-500">No GPUs on this node</span>
                      ) : (
                        gpus.map((gpuIndex) => {
                          const selected = target.gpu_indices.includes(gpuIndex);
                          const gpu = node?.gpus.find((item) => item.index === gpuIndex);
                          return (
                            <button
                              key={gpuIndex}
                              type="button"
                              onClick={() => togglePlacementGpu(index, gpuIndex)}
                              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                                selected
                                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
                                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              GPU {gpuIndex}
                              {gpu ? ` · ${Math.round(gpu.vram_mb / 1024)} GB` : ''}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            <FieldLabel
              label={`Instances${instancesAuto ? ' (auto)' : ''}`}
              hint={instancesAuto ? DEPLOYMENT_VOCAB.instancesAuto : DEPLOYMENT_VOCAB.instances}
            >
            <Input
              type="number"
              min={1}
              disabled={instancesAuto}
              value={instancesAuto ? 1 : dep.parallelism.instances}
              onChange={(e) => updateParallelism({ instances: +e.target.value })}
            />
            </FieldLabel>
          </div>
          <div>
            <FieldLabel
              label={`GPUs per instance${mode.standalone ? ' (max per node)' : ' (tensor parallel)'}`}
              hint={DEPLOYMENT_VOCAB.gpusPerInstance}
            >
            <Input
              type="number"
              min={1}
              value={dep.parallelism.gpus_per_instance}
              onChange={(e) => updateParallelism({ gpus_per_instance: +e.target.value })}
            />
            </FieldLabel>
          </div>
          {mode.showNodesPerInstance && (
            <div>
              <FieldLabel
                label="Nodes per instance (pipeline parallel)"
                hint={DEPLOYMENT_VOCAB.nodesPerInstance}
              >
              <Input
                type="number"
                min={1}
                value={dep.parallelism.nodes_per_instance}
                onChange={(e) => updateParallelism({ nodes_per_instance: +e.target.value })}
              />
              </FieldLabel>
            </div>
          )}
          <div>
            <FieldLabel label="Context length" hint={DEPLOYMENT_VOCAB.contextLength}>
            <Input
              type="number"
              value={dep.parallelism.context_length}
              onChange={(e) => updateParallelism({ context_length: +e.target.value })}
            />
            </FieldLabel>
          </div>
          <div>
            <FieldLabel label="GPU memory utilization" hint={DEPLOYMENT_VOCAB.gpuUtilization}>
            <Input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={dep.parallelism.gpu_utilization ?? 0.85}
              onChange={(e) => updateParallelism({ gpu_utilization: +e.target.value })}
            />
            </FieldLabel>
          </div>
          {mode.showAutoscaling && (
            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-800 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!!dep.parallelism.autoscaling}
                  onChange={(e) =>
                    setDep((current) => ({
                      ...current,
                      parallelism: {
                        ...current.parallelism,
                        autoscaling: e.target.checked
                          ? {
                              min_instances: 1,
                              max_instances: Math.max(2, current.parallelism.instances),
                              target_ongoing_requests: 8,
                            }
                          : null,
                      },
                    }))
                  }
                  className="rounded border-slate-600"
                />
                <span title={DEPLOYMENT_VOCAB.autoscaling}>Ray Serve autoscaling ⓘ</span>
              </label>
              {dep.parallelism.autoscaling && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Min replicas</Label>
                    <Input
                      type="number"
                      min={1}
                      value={dep.parallelism.autoscaling.min_instances}
                      onChange={(e) =>
                        updateParallelism({
                          autoscaling: {
                            ...dep.parallelism.autoscaling!,
                            min_instances: +e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max replicas</Label>
                    <Input
                      type="number"
                      min={1}
                      value={dep.parallelism.autoscaling.max_instances}
                      onChange={(e) =>
                        updateParallelism({
                          autoscaling: {
                            ...dep.parallelism.autoscaling!,
                            max_instances: +e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Target requests</Label>
                    <Input
                      type="number"
                      min={1}
                      value={dep.parallelism.autoscaling.target_ongoing_requests}
                      onChange={(e) =>
                        updateParallelism({
                          autoscaling: {
                            ...dep.parallelism.autoscaling!,
                            target_ongoing_requests: +e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="md:col-span-2">
            <p className="text-sm text-slate-500">
              Quantization is determined by the HuggingFace repo. Use a pre-quantized model
              (for example AWQ or GPTQ in the repo name) that fits your GPU VRAM.
            </p>
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
        <Button onClick={handleSave} disabled={!canSave}>
          {initial ? 'Save changes' : 'Add deployment'}
        </Button>
      </div>
    </div>
  );
}