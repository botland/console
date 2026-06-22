'use client';

import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';

import { Button, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { toSortedJson } from '@/lib/sort-json';
import type { ApplianceConfig } from '@/lib/types';

export default function ConfigPage() {
  const [config, setConfig] = useState<ApplianceConfig | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const load = () => api.getConfig().then(setConfig).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const handleImport = async () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      await api.importConfig(parsed);
      setImportText('');
      load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  if (!config) return <div className="text-slate-500">Loading…</div>;

  return (
    <>
      <PageHeader
        title="Configuration"
        description="Export, import, and USB recovery"
        action={
          <Button onClick={() => api.exportConfig()}>
            <Download className="w-4 h-4" /> Export conf.json
          </Button>
        }
      />

      <Card className="mb-6">
        <h2 className="font-display font-semibold text-slate-100 mb-2">
          USB dongle recovery
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Place <code className="text-cyan-400/80">conf.json</code> on a USB dongle mounted at{' '}
          <code className="text-slate-300">/mnt/dongles/&lt;device&gt;/</code>.
          The appliance copies it to <code className="text-slate-300">/home/conf.json</code> when
          changed (see <code className="text-slate-300">usb-dongle-check.sh</code>).
          Export below produces jq-sorted JSON compatible with that workflow.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display font-semibold text-slate-100 mb-4">
            Current config
          </h2>
          <pre className="text-xs text-slate-400 overflow-auto max-h-[60vh] rounded-xl bg-slate-950 p-4 border border-slate-800">
            {toSortedJson(config)}
          </pre>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-slate-100 mb-4">
            Import config
          </h2>
          <textarea
            className="w-full h-64 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300 font-mono focus:border-cyan-500/50 focus:outline-none"
            placeholder="Paste conf.json contents…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importError && (
            <p className="mt-2 text-sm text-red-400">{importError}</p>
          )}
          <Button className="mt-4" onClick={handleImport} disabled={!importText.trim()}>
            <Upload className="w-4 h-4" /> Import and apply
          </Button>
        </Card>
      </div>
    </>
  );
}