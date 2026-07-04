'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function BlockingOverlay({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-6"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 px-8 py-10 shadow-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-100">{title}</h2>
        {detail && <p className="mt-3 text-sm leading-relaxed text-slate-400">{detail}</p>}
        <p className="mt-4 text-xs text-slate-500">
          Please wait — the console is locked until this finishes.
        </p>
      </div>
    </div>
  );
}