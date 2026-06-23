'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { NodeBadge } from '@/components/StatusBadge';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { NodeWithAgent } from '@/lib/api';
import type { NodeConfig } from '@/lib/types';

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeWithAgent[]>([]);
  const [enabledDeployments, setEnabledDeployments] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NodeConfig>>({});
  const [headCandidate, setHeadCandidate] = useState<string | null>(null);

  const load = () =>
    Promise.all([api.listNodes(), api.getConfig()])
      .then(([nodeList, config]) => {
        setNodes(nodeList);
        setEnabledDeployments(config.deployments.filter((d) => d.enabled).length);
      })
      .catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const formatLastSeen = (ts?: number) => {
    if (!ts) return 'unknown';
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    return `${Math.round(sec / 60)}m ago`;
  };

  const startEdit = (node: NodeWithAgent) => {
    setEditing(node.id);
    setDraft({
      gpus_reserved_for_system: node.gpus_reserved_for_system,
      labels: [...node.labels],
    });
  };

  const save = async (id: string) => {
    await api.updateNode(id, draft);
    setEditing(null);
    load();
  };

  const confirmSetHead = async () => {
    if (!headCandidate) return;
    await api.migrateHead(headCandidate);
    setHeadCandidate(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Nodes"
        description="Hardware resource pool"
      />

      <div className="space-y-4">
        {nodes.map((node) => (
          <Card key={node.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display font-semibold text-slate-100">
                    {node.hostname}
                  </span>
                  <NodeBadge status={node.status} />
                  {node.is_head && (
                    <span className="text-xs rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-400">
                      head
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-400">{node.ip}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {node.gpus.length} GPU(s)
                  {node.labels.length > 0 && ` · ${node.labels.join(', ')}`}
                  {node.agent && (
                    <>
                      {' '}
                      · agent {node.agent.agent_phase} · seen {formatLastSeen(node.agent.last_seen)}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!node.is_head && node.status === 'online' && (
                  <Button variant="secondary" onClick={() => setHeadCandidate(node.id)}>
                    Set as head
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    setExpanded(expanded === node.id ? null : node.id)
                  }
                >
                  {expanded === node.id ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {expanded === node.id && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="text-xs font-medium text-slate-500 mb-2">GPUs</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {node.gpus.map((g) => (
                    <div
                      key={g.index}
                      className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400"
                    >
                      GPU {g.index}: {g.name} ({(g.vram_mb / 1024).toFixed(0)} GB)
                    </div>
                  ))}
                </div>

                {editing === node.id ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 max-w-lg">
                    <div>
                      <Label>GPUs reserved for system</Label>
                      <Input
                        type="number"
                        min={0}
                        max={node.gpus.length}
                        value={draft.gpus_reserved_for_system ?? 0}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            gpus_reserved_for_system: +e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Labels (comma-separated)</Label>
                      <Input
                        value={(draft.labels ?? []).join(', ')}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            labels: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button onClick={() => save(node.id)}>Save</Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => startEdit(node)}
                  >
                    Edit node settings
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!headCandidate}
        title="Migrate head to this node?"
        message={`The control plane will move to this node. ${enabledDeployments} deployment(s) will reschedule. All workers will reconnect to the new head.`}
        confirmLabel="Migrate head"
        danger
        onConfirm={confirmSetHead}
        onCancel={() => setHeadCandidate(null)}
      />
    </>
  );
}