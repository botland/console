'use client';

import { useCallback, useEffect, useState } from 'react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatNodeLabel } from '@/lib/node-label';
import { useApplianceStatus } from '@/lib/status-context';
import type { SystemConfig } from '@/lib/types';

type IdentityDraft = {
  hostname: string;
  ip: string;
};

export default function SystemPage() {
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [draft, setDraft] = useState<SystemConfig | null>(null);
  const [identity, setIdentity] = useState<IdentityDraft | null>(null);
  const [identityBaseline, setIdentityBaseline] = useState<IdentityDraft | null>(null);
  const { status: applianceStatus } = useApplianceStatus();
  const gateway = applianceStatus?.gateway ?? null;
  const localNodeId = gateway?.local_node_id ?? null;
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api.getSystem().then((s) => {
        setSystem(s);
        setDraft(s);
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

  useEffect(() => {
    if (identityBaseline !== null || !localNodeId || !applianceStatus?.config) {
      return;
    }
    const localNode =
      applianceStatus.config.nodes.find((n) => n.id === localNodeId) ??
      { hostname: '', ip: '' };
    const idDraft = { hostname: localNode.hostname, ip: localNode.ip };
    setIdentity(idDraft);
    setIdentityBaseline(idDraft);
  }, [applianceStatus, identityBaseline, localNodeId]);

  const hostnameChanged =
    identity &&
    identityBaseline &&
    identity.hostname !== identityBaseline.hostname;

  const ipChanged =
    identity && identityBaseline && identity.ip !== identityBaseline.ip;

  const networkChanged =
    system &&
    draft &&
    (draft.network.gateway !== system.network.gateway ||
      draft.network.dns.join(',') !== system.network.dns.join(','));

  const save = async () => {
    if (!draft || !identity) return;
    if (!identity.hostname.trim()) {
      setSaveError('Hostname is required');
      return;
    }
    setSaveError(null);
    try {
      if ((hostnameChanged || ipChanged) && localNodeId) {
        await api.updateNode(localNodeId, {
          ...(hostnameChanged ? { hostname: identity.hostname.trim() } : {}),
          ...(ipChanged ? { ip: identity.ip.trim() } : {}),
        });
        setIdentityBaseline(identity);
      }
      const saved = await api.putSystem(draft);
      setSystem(saved);
      setDraft(saved);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save system settings');
    }
  };

  const hasChanges = hostnameChanged || ipChanged || networkChanged;

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {draft && identity && (
        <>
          <PageHeader
            title="System"
            description={
              gateway?.is_head
                ? 'Host network and appliance settings for this coordinator'
                : 'Host network and appliance settings for this worker'
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <Card className="space-y-4 lg:col-span-2">
              <h2 className="font-display font-semibold text-slate-100">This appliance</h2>
              <p className="text-sm text-slate-400">
                Currently {formatNodeLabel(identity.hostname, identity.ip)}. Hostname and IP
                identify this machine in the cluster.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
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
                  <Label>IP address</Label>
                  <Input
                    value={identity.ip}
                    onChange={(e) => setIdentity({ ...identity, ip: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            <Card className="space-y-4 lg:col-span-2">
              <h2 className="font-display font-semibold text-slate-100">Network</h2>
              <p className="text-sm text-slate-400">
                Gateway and DNS apply to the host network stack on this appliance.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
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
            <Button onClick={() => void save()} disabled={!hasChanges}>
              Apply system settings
            </Button>
          </div>
        </>
      )}
    </PageState>
  );
}