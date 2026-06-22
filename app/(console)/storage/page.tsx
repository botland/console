'use client';

import { useEffect, useState } from 'react';
import { Folder, Plus, Trash2 } from 'lucide-react';

import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import type { StorageMount } from '@/lib/types';

function formatBytes(n: number): string {
  const tb = n / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = n / 1024 ** 3;
  return `${gb.toFixed(0)} GB`;
}

export default function StoragePage() {
  const [data, setData] = useState<{
    total_bytes: number;
    used_bytes: number;
    paths: Record<string, { name: string; size_bytes: number; type: string }[]>;
    mounts: StorageMount[];
  } | null>(null);
  const [browsePath, setBrowsePath] = useState('/models/hf-cache');
  const [showAddMount, setShowAddMount] = useState(false);
  const [mountForm, setMountForm] = useState({
    type: 'nfs' as StorageMount['type'],
    remote: '',
    local_path: '',
  });

  const load = () => api.getStorage().then(setData).catch(console.error);

  useEffect(() => {
    load();
  }, []);

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

  if (!data) return <div className="text-slate-500">Loading…</div>;

  const pct = Math.round((data.used_bytes / data.total_bytes) * 100);
  const entries = data.paths[browsePath] ?? [];

  return (
    <>
      <PageHeader
        title="Storage"
        description="Model cache, uploads, and mounted volumes"
      />

      <Card className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Disk usage</span>
          <span className="text-slate-300">
            {formatBytes(data.used_bytes)} / {formatBytes(data.total_bytes)} ({pct}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-500/60"
            style={{ width: `${pct}%` }}
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
            {entries.map((e) => (
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
                    })
                  }
                >
                  <option value="nfs">NFS</option>
                  <option value="smb">SMB</option>
                  <option value="s3" disabled>
                    S3 (coming soon)
                  </option>
                </Select>
              </div>
              <div>
                <Label>Remote</Label>
                <Input
                  value={mountForm.remote}
                  onChange={(e) =>
                    setMountForm({ ...mountForm, remote: e.target.value })
                  }
                  placeholder="192.168.1.100:/models"
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
                <Button onClick={addMount}>Save mount</Button>
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
          </div>
        </Card>
      </div>
    </>
  );
}