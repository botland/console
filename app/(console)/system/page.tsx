'use client';

import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { SystemConfig } from '@/lib/types';

export default function SystemPage() {
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [draft, setDraft] = useState<SystemConfig | null>(null);
  const [headIpWarning, setHeadIpWarning] = useState(false);

  useEffect(() => {
    api.getSystem().then((s) => {
      setSystem(s);
      setDraft(s);
    });
  }, []);

  const save = async () => {
    if (!draft) return;
    const saved = await api.putSystem(draft);
    setSystem(saved);
    setDraft(saved);
    setHeadIpWarning(false);
  };

  if (!draft) return <div className="text-slate-500">Loading…</div>;

  const headIpChanged =
    system && draft.network.head_ip !== system.network.head_ip;

  return (
    <>
      <PageHeader
        title="System"
        description="Network, time, and security settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <Card className="space-y-4">
          <h2 className="font-display font-semibold text-slate-100">Network</h2>
          <div>
            <Label>Head node IP</Label>
            <Input
              value={draft.network.head_ip}
              onChange={(e) => {
                setDraft({
                  ...draft,
                  network: { ...draft.network, head_ip: e.target.value },
                });
                if (e.target.value !== system?.network.head_ip) {
                  setHeadIpWarning(true);
                }
              }}
            />
          </div>
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

      <div className="mt-6">
        <Button
          onClick={() => (headIpChanged ? setHeadIpWarning(true) : save())}
        >
          Apply system settings
        </Button>
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
  );
}