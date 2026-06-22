'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { NodeBadge } from '@/components/StatusBadge';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { NodeConfig } from '@/lib/types';

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeConfig[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NodeConfig>>({});

  const load = () => api.listNodes().then(setNodes).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const startEdit = (node: NodeConfig) => {
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

  const setHead = async (id: string) => {
    await api.updateNode(id, { roles: { head: true, litellm_proxy: false } });
    load();
  };

  return (
    <>
      <PageHeader
        title="Nodes"
        description="Infrastructure resource pool — minimal per-node settings"
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
                  {node.roles.head && (
                    <span className="text-xs rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-400">
                      head
                    </span>
                  )}
                  {node.roles.litellm_proxy && (
                    <span className="text-xs rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-purple-400">
                      litellm
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-400">{node.ip}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {node.gpus.length} GPU(s)
                  {node.labels.length > 0 && ` · ${node.labels.join(', ')}`}
                </div>
              </div>
              <div className="flex gap-2">
                {!node.roles.head && (
                  <Button variant="secondary" onClick={() => setHead(node.id)}>
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
    </>
  );
}