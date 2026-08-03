'use client';

import { useCallback, useEffect, useState } from 'react';
import { Folder, Plus, Trash2 } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { StorageMount } from '@/lib/types';

function formatBytes(n: number): string {
  const tb = n / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = n / 1024 ** 3;
  return `${gb.toFixed(0)} GB`;
}

function remotePlaceholder(type: StorageMount['type']): string {
  switch (type) {
    case 'nfs':
      return '192.168.1.100:/models';
    case 'smb':
      return '//fileserver/models';
    case 's3':
      return 's3://my-bucket/models';
    case 'minio':
      return 'http://minio.example:9000/my-bucket/models';
    default:
      return '';
  }
}

function remoteHint(type: StorageMount['type']): string {
  switch (type) {
    case 'nfs':
      return 'host:/export path';
    case 'smb':
      return '//server/share';
    case 's3':
      return 'AWS S3 (or any S3 API) URI — bucket/prefix';
    case 'minio':
      return 'MinIO is S3-compatible: endpoint URL + bucket/path (credentials via install or source config later)';
    default:
      return '';
  }
}

export default function StoragePage() {
  const [data, setData] = useState<{
    total_bytes: number;
    used_bytes: number;
    paths: Record<string, { name: string; size_bytes: number; type: string }[]>;
    mounts: StorageMount[];
    hf_token_set?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [browsePath, setBrowsePath] = useState('/models/hf-cache');
  const [showAddMount, setShowAddMount] = useState(false);
  const [mountForm, setMountForm] = useState({
    type: 'nfs' as StorageMount['type'],
    remote: '',
    local_path: '',
  });
  const [hfTokenDraft, setHfTokenDraft] = useState('');
  const [hfBusy, setHfBusy] = useState(false);
  const [hfMsg, setHfMsg] = useState<string | null>(null);
  const [hfErr, setHfErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .getStorage()
      .then((storage) => {
        setData(storage);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load storage');
        setLoading(false);
        console.error(e);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMount = async () => {
    await api.addMount(mountForm);
    setShowAddMount(false);
    setMountForm({ type: 'nfs', remote: '', local_path: '' });
    load();
  };

  const removeMount = async (id: string) => {
    await api.deleteMount(id);
    load();
  };

  const saveHfToken = async () => {
    setHfBusy(true);
    setHfErr(null);
    setHfMsg(null);
    try {
      const res = await api.putHfToken(hfTokenDraft);
      setHfTokenDraft('');
      setHfMsg(
        res.hf_token_set
          ? 'Hugging Face token saved (value is never shown again).'
          : 'Console token cleared; env HF_TOKEN still applies if set on the controller.',
      );
      load();
    } catch (e) {
      setHfErr(e instanceof ApiError ? e.message : 'Failed to save HF token');
    } finally {
      setHfBusy(false);
    }
  };

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {data && (
        <>
          <PageHeader
            title="Storage"
            description="Model cache, mounts (NFS/SMB/S3/MinIO), and Hugging Face token for gated models"
          />

          <Card className="mb-6 space-y-4 max-w-2xl">
            <div>
              <h2 className="font-display font-semibold text-slate-100">Hugging Face token</h2>
              <p className="mt-1 text-sm text-slate-400">
                Used to download gated/private models. Saved to the appliance (controller) — not a
                UI-only mock. The secret is never returned; only whether one is effective.
              </p>
            </div>
            <div className="text-sm text-slate-300">
              Status:{' '}
              {data.hf_token_set ? (
                <span className="text-emerald-400">Token configured</span>
              ) : (
                <span className="text-amber-400">Not set (gated models will fail)</span>
              )}
            </div>
            <div>
              <Label>New token</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder={data.hf_token_set ? '••••••••  (enter to replace)' : 'hf_…'}
                value={hfTokenDraft}
                onChange={(e) => setHfTokenDraft(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave empty and save to clear the console-stored token (install{' '}
                <code className="text-slate-400">HF_TOKEN</code> still applies if present).
              </p>
            </div>
            {hfMsg && <p className="text-sm text-emerald-400/90">{hfMsg}</p>}
            {hfErr && <p className="text-sm text-red-400">{hfErr}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveHfToken} disabled={hfBusy}>
                {hfBusy ? 'Saving…' : 'Save token'}
              </Button>
              {data.hf_token_set && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={hfBusy}
                  onClick={async () => {
                    setHfTokenDraft('');
                    setHfBusy(true);
                    setHfErr(null);
                    try {
                      await api.putHfToken('');
                      setHfMsg('Console token cleared.');
                      load();
                    } catch (e) {
                      setHfErr(e instanceof ApiError ? e.message : 'Failed to clear');
                    } finally {
                      setHfBusy(false);
                    }
                  }}
                >
                  Clear console token
                </Button>
              )}
            </div>
          </Card>

          <Card className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Disk usage</span>
              <span className="text-slate-300">
                {formatBytes(data.used_bytes)} / {formatBytes(data.total_bytes)} (
                {Math.round((data.used_bytes / data.total_bytes) * 100)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500/60"
                style={{ width: `${Math.round((data.used_bytes / data.total_bytes) * 100)}%` }}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-slate-100">Browse</h2>
                <Select
                  className="w-auto"
                  value={browsePath}
                  onChange={(e) => setBrowsePath(e.target.value)}
                >
                  {Object.keys(data.paths).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                {(data.paths[browsePath] ?? []).map((e) => (
                  <div
                    key={e.name}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <Folder className="w-4 h-4 text-cyan-400/70" />
                    <span className="text-slate-300 flex-1">{e.name}</span>
                    <span className="text-slate-500 text-xs">
                      {formatBytes(e.size_bytes)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-slate-100">Mounts</h2>
                <Button onClick={() => setShowAddMount(true)}>
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>

              {showAddMount && (
                <div className="mb-4 space-y-3 rounded-xl border border-slate-700 p-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={mountForm.type}
                      onChange={(e) =>
                        setMountForm({
                          ...mountForm,
                          type: e.target.value as StorageMount['type'],
                          remote: '',
                        })
                      }
                    >
                      <option value="nfs">NFS</option>
                      <option value="smb">SMB</option>
                      <option value="s3">S3 (AWS / S3 API)</option>
                      <option value="minio">MinIO (S3-compatible)</option>
                    </Select>
                    <p className="mt-1 text-xs text-slate-500">{remoteHint(mountForm.type)}</p>
                  </div>
                  <div>
                    <Label>Remote</Label>
                    <Input
                      value={mountForm.remote}
                      onChange={(e) =>
                        setMountForm({ ...mountForm, remote: e.target.value })
                      }
                      placeholder={remotePlaceholder(mountForm.type)}
                    />
                  </div>
                  <div>
                    <Label>Local path</Label>
                    <Input
                      value={mountForm.local_path}
                      onChange={(e) =>
                        setMountForm({ ...mountForm, local_path: e.target.value })
                      }
                      placeholder="/models/customer-nfs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={addMount}
                      disabled={!mountForm.remote.trim() || !mountForm.local_path.trim()}
                    >
                      Save mount
                    </Button>
                    <Button variant="ghost" onClick={() => setShowAddMount(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {data.mounts.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-cyan-400/80 uppercase text-xs">{m.type}</span>
                      <div className="text-slate-300">{m.remote}</div>
                      <div className="text-xs text-slate-500">{m.local_path}</div>
                    </div>
                    <Button variant="danger" onClick={() => removeMount(m.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {data.mounts.length === 0 && (
                  <p className="text-sm text-slate-500">No mounts registered yet.</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </PageState>
  );
}
