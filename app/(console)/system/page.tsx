'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { GatewayInfo, SystemConfig } from '@/lib/types';

type IdentityDraft = {
  hostname: string;
  ip: string;
};

export default function SystemPage() {
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [draft, setDraft] = useState<SystemConfig | null>(null);
  const [identity, setIdentity] = useState<IdentityDraft | null>(null);
  const [identityBaseline, setIdentityBaseline] = useState<IdentityDraft | null>(null);
  const [localNodeId, setLocalNodeId] = useState<string | null>(null);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);
  const [coordinatorIp, setCoordinatorIp] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [headIpWarning, setHeadIpWarning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([api.getSystem(), api.status()])
      .then(([s, status]) => {
        const gw = status.gateway;
        const nodeId = gw?.local_node_id ?? null;
        const localNode =
          status.config?.nodes.find((n) => n.id === nodeId) ??
          (nodeId ? { hostname: '', ip: '' } : null);

        setSystem(s);
        setDraft(s);
        setGateway(gw ?? null);
        setCoordinatorIp(status.head?.head_ip ?? s.network.head_ip ?? '');
        setLocalNodeId(nodeId);
        if (localNode) {
          const idDraft = { hostname: localNode.hostname, ip: localNode.ip };
          setIdentity(idDraft);
          setIdentityBaseline(idDraft);
        } else {
          setIdentity(null);
          setIdentityBaseline(null);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load system settings');
        setLoading(false);
        console.error(e);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const identityChanged =
    identity &&
    identityBaseline &&
    (identity.hostname !== identityBaseline.hostname || identity.ip !== identityBaseline.ip);

  const headIpChanged =
    gateway?.is_head &&
    system &&
    draft &&
    draft.network.head_ip !== system.network.head_ip;

  const save = async () => {
    if (!draft) return;
    setSaveError(null);
    try {
      if (identityChanged && localNodeId && identity) {
        await api.updateNode(localNodeId, {
          hostname: identity.hostname,
          ip: identity.ip,
        });
        setIdentityBaseline(identity);
      }
      const saved = await api.putSystem(draft);
      setSystem(saved);
      setDraft(saved);
      setHeadIpWarning(false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save system settings');
    }
  };

  const apply = () => {
    if (headIpChanged) {
      setHeadIpWarning(true);
      return;
    }
    void save();
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {draft && (
        <>
          <PageHeader
            title="System"
            description={
              gateway?.is_head
                ? 'This coordinator appliance and cluster network settings'
                : 'This worker appliance — local identity below; coordinator IP is read-only'
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            {localNodeId && identity && (
              <Card className="space-y-4 lg:col-span-2">
                <h2 className="font-display font-semibold text-slate-100">This appliance</h2>
                <p className="text-sm text-slate-400">
                  Hostname and IP identify this machine in the cluster. Edit them here on each
                  appliance — not from the head Nodes page.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
                  <div>
                    <Label>Node ID</Label>
                    <Input value={localNodeId} readOnly className="text-slate-400" />
                  </div>
                  <div>
                    <Label>Hostname</Label>
                    <Input
                      value={identity.hostname}
                      onChange={(e) =>
                        setIdentity({ ...identity, hostname: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>IP address (this machine)</Label>
                    <Input
                      value={identity.ip}
                      onChange={(e) => setIdentity({ ...identity, ip: e.target.value })}
                    />
                  </div>
                </div>
              </Card>
            )}

            <Card className="space-y-4">
              <h2 className="font-display font-semibold text-slate-100">Network</h2>
              {gateway?.is_head ? (
                <div>
                  <Label>Coordinator IP (this appliance)</Label>
                  <p className="text-xs text-slate-500 mb-1">
                    Workers use this address to reach the cluster coordinator.
                  </p>
                  <Input
                    value={draft.network.head_ip}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        network: { ...draft.network, head_ip: e.target.value },
                      })
                    }
                  />
                </div>
              ) : (
                <div>
                  <Label>Coordinator IP</Label>
                  <p className="text-xs text-slate-500 mb-1">
                    Remote head for this worker — not this machine&apos;s IP. Edit under
                    System on the coordinator, or set HEAD_IP in .env before first boot.
                  </p>
                  <Input value={coordinatorIp} readOnly className="text-slate-400" />
                </div>
              )}
              <div>
                <Label>Gateway</Label>
                <Input
                  value={draft.network.gateway}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      network: { ...draft.network, gateway: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>DNS servers (comma-separated)</Label>
                <Input
                  value={draft.network.dns.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      network: {
                        ...draft.network,
                        dns: e.target.value.split(',').map((s) => s.trim()),
                      },
                    })
                  }
                />
              </div>
            </Card>

            <Card className="space-y-4">
              <h2 className="font-display font-semibold text-slate-100">Time & security</h2>
              <div>
                <Label>NTP servers</Label>
                <Input
                  value={draft.time.ntp_servers.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      time: {
                        ntp_servers: e.target.value.split(',').map((s) => s.trim()),
                      },
                    })
                  }
                />
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 text-sm">
                <span className="text-slate-400">API token: </span>
                <span className={draft.security.api_token_set ? 'text-emerald-400' : 'text-amber-400'}>
                  {draft.security.api_token_set ? 'Configured' : 'Not set'}
                </span>
              </div>
            </Card>
          </div>

          <div className="mt-6 space-y-2">
            {saveError && <p className="text-sm text-amber-400">{saveError}</p>}
            <Button onClick={apply}>Apply system settings</Button>
          </div>

          <ConfirmDialog
            open={headIpWarning}
            title="Change head IP?"
            message="Changing the head IP affects all nodes and running deployments. Workers will reconnect to the head. You may need to open the console at the new address."
            confirmLabel="Apply anyway"
            danger
            onConfirm={save}
            onCancel={() => setHeadIpWarning(false)}
          />
        </>
      )}
    </PageState>
  );
}