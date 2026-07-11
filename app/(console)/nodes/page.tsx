'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageError, PageLoading } from '@/components/PageState';
import { AgentPhaseBadge, NodeBadge } from '@/components/StatusBadge';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApplianceStatus } from '@/lib/status-context';
import type { NodeWithAgent } from '@/lib/api';
import {
  buildConsoleContext,
  canEditNodePlacement,
  canJoinCluster,
  canMigrateHead,
  isStandalone,
} from '@/lib/console-capabilities';
import { formatNodeLabelFromNode } from '@/lib/node-label';
import { nodeConsoleUrl } from '@/lib/node-console';
import type { NodeConfig } from '@/lib/types';

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeWithAgent[]>([]);
  const { status: applianceStatus } = useApplianceStatus();
  const gateway = applianceStatus?.gateway ?? null;
  const cluster = applianceStatus?.config?.cluster ?? null;
  const enabledDeployments =
    applianceStatus?.config?.deployments.filter((d) => d.enabled).length ?? 0;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NodeConfig>>({});
  const [headCandidate, setHeadCandidate] = useState<string | null>(null);
  const [consoleTarget, setConsoleTarget] = useState<NodeWithAgent | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [coordinatorAddress, setCoordinatorAddress] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [openCoordinatorConfirm, setOpenCoordinatorConfirm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api.listNodes().then((nodeList) => {
        setNodes(nodeList);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load nodes');
        setLoading(false);
        console.error(e);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ctx =
    gateway && cluster ? buildConsoleContext(gateway, cluster) : null;
  const localNodeId = gateway?.local_node_id;
  const standalone = cluster ? isStandalone(cluster) : false;

  const formatLastSeen = (ts?: number) => {
    if (!ts) return 'unknown';
    const seenMs = ts < 1e12 ? ts * 1000 : ts;
    const sec = Math.max(0, Math.round((Date.now() - seenMs) / 1000));
    if (sec < 60) return `${sec}s ago`;
    return `${Math.round(sec / 60)}m ago`;
  };

  const startEdit = (node: NodeWithAgent) => {
    setEditing(node.id);
    setSaveError(null);
    setDraft({
      gpus_reserved_for_system: node.gpus_reserved_for_system,
      labels: [...node.labels],
    });
  };

  const save = async (id: string) => {
    try {
      await api.updateNode(id, draft);
      setEditing(null);
      setSaveError(null);
      load();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save node');
    }
  };

  const confirmSetHead = async () => {
    if (!headCandidate) return;
    await api.migrateHead(headCandidate);
    setHeadCandidate(null);
    load();
  };

  const confirmJoin = async () => {
    setJoinError(null);
    try {
      await api.joinCluster(coordinatorAddress.trim());
      setJoinOpen(false);
      setCoordinatorAddress('');
      load();
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : 'Failed to join cluster');
    }
  };

  const openConsole = (node: NodeWithAgent) => {
    window.open(nodeConsoleUrl(node.ip), '_blank', 'noopener,noreferrer');
    setConsoleTarget(null);
  };

  if (loading && nodes.length === 0 && !error) {
    return <PageLoading />;
  }

  const selfNode = nodes.find((n) => n.id === localNodeId);

  const nodeLabel = (id: string) => {
    const n = nodes.find((item) => item.id === id);
    return n ? formatNodeLabelFromNode(n) : id;
  };

  return (
    <>
      <PageHeader
        title="Nodes"
        description={
          standalone
            ? 'This appliance and cluster membership'
            : 'Cluster members — open another node’s console to manage it locally'
        }
      />

      {error && (
        <div className="mb-6">
          <PageError error={error} onRetry={load} />
        </div>
      )}

      {standalone && ctx && canJoinCluster(ctx) && (
        <Card className="mb-6 space-y-4">
          <h2 className="font-display font-semibold text-slate-100">Join a cluster</h2>
          <p className="text-sm text-slate-400">
            Point this standalone appliance at an existing distributed coordinator. You can
            inspect the coordinator console before joining.
          </p>
          <div className="flex flex-wrap gap-3 items-end max-w-xl">
            <div className="flex-1 min-w-[200px]">
              <Label>Coordinator address</Label>
              <Input
                placeholder="10.0.0.2"
                value={coordinatorAddress}
                onChange={(e) => setCoordinatorAddress(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              disabled={!coordinatorAddress.trim()}
              onClick={() => setOpenCoordinatorConfirm(true)}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open coordinator console
            </Button>
            <Button disabled={!coordinatorAddress.trim()} onClick={() => setJoinOpen(true)}>
              Join cluster
            </Button>
          </div>
          {joinError && <p className="text-sm text-amber-400">{joinError}</p>}
        </Card>
      )}

      <div className="space-y-4">
        {(standalone && selfNode ? [selfNode] : nodes).map((node) => {
          const isHere = node.id === localNodeId;
          const headMismatch =
            node.agent &&
            cluster &&
            node.agent.head_target_node_id !== cluster.head_node_id;

          return (
            <Card key={node.id} className={isHere ? 'ring-1 ring-cyan-500/30' : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-display font-semibold text-slate-100">
                      {formatNodeLabelFromNode(node)}
                    </span>
                    <NodeBadge status={node.status} />
                    {node.agent && <AgentPhaseBadge phase={node.agent.agent_phase} />}
                    {node.is_head && (
                      <span className="text-xs rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-400">
                        coordinator
                      </span>
                    )}
                    {isHere && (
                      <span className="text-xs rounded-lg border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-slate-300">
                        you are here
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {node.gpus.length} GPU(s)
                    {node.labels.length > 0 && ` · ${node.labels.join(', ')}`}
                    {node.agent && <> · seen {formatLastSeen(node.agent.last_seen)}</>}
                  </div>
                  {headMismatch && (
                    <p className="mt-1 text-xs text-amber-400">
                      Agent targets {nodeLabel(node.agent!.head_target_node_id)}, cluster
                      coordinator is {nodeLabel(cluster!.head_node_id)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isHere && (
                    <Button variant="secondary" onClick={() => setConsoleTarget(node)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open console
                    </Button>
                  )}
                  {ctx && canMigrateHead(ctx) && !node.is_head && node.status === 'online' && (
                    <Button variant="secondary" onClick={() => setHeadCandidate(node.id)}>
                      Set as head
                    </Button>
                  )}
                  {!standalone && (
                    <Button
                      variant="ghost"
                      onClick={() => setExpanded(expanded === node.id ? null : node.id)}
                    >
                      {expanded === node.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  )}
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

                  {ctx && canEditNodePlacement(ctx) && (
                    <>
                      {editing === node.id ? (
                        <div className="mt-4 grid grid-cols-2 gap-4 max-w-lg">
                          <p className="col-span-2 text-xs text-slate-500">
                            Hostname and IP are edited on each appliance under System.
                          </p>
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
                          {saveError && (
                            <div className="col-span-2 text-sm text-amber-400">{saveError}</div>
                          )}
                          <div className="col-span-2 flex gap-2">
                            <Button onClick={() => save(node.id)}>Save</Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditing(null);
                                setSaveError(null);
                              }}
                            >
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
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!headCandidate}
        title="Migrate head to this node?"
        message={`The control plane will move to ${headCandidate ? nodeLabel(headCandidate) : 'this node'}. ${enabledDeployments} deployment(s) will reschedule. All workers will reconnect to the new head.`}
        confirmLabel="Migrate head"
        danger
        onConfirm={confirmSetHead}
        onCancel={() => setHeadCandidate(null)}
      />

      <ConfirmDialog
        open={!!consoleTarget}
        title="Open another console?"
        message={
          consoleTarget
            ? `You will open the console for ${formatNodeLabelFromNode(consoleTarget)} in a new tab. Cluster-wide changes belong on the coordinator console.`
            : ''
        }
        confirmLabel="Open console"
        onConfirm={() => consoleTarget && openConsole(consoleTarget)}
        onCancel={() => setConsoleTarget(null)}
      />

      <ConfirmDialog
        open={openCoordinatorConfirm}
        title="Open coordinator console?"
        message={`Inspect the cluster at ${coordinatorAddress.trim()} before joining. Joining makes this appliance a worker in that cluster.`}
        confirmLabel="Open console"
        onConfirm={() => {
          window.open(
            nodeConsoleUrl(coordinatorAddress.trim()),
            '_blank',
            'noopener,noreferrer',
          );
          setOpenCoordinatorConfirm(false);
        }}
        onCancel={() => setOpenCoordinatorConfirm(false)}
      />

      <ConfirmDialog
        open={joinOpen}
        title="Join this cluster?"
        message="This appliance will become a worker in the distributed cluster. Local standalone deployments will reschedule. Head migration from that cluster to this node will only be possible while you remain a member."
        confirmLabel="Join cluster"
        danger
        onConfirm={confirmJoin}
        onCancel={() => setJoinOpen(false)}
      />
    </>
  );
}