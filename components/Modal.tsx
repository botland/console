'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Lightweight centered modal overlay (Escape to close, backdrop click).
 * Mirrors the pattern used by ConfirmDialog / QualificationDialog.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  className,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** max-w-3xl instead of max-w-2xl */
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl',
          wide ? 'max-w-3xl' : 'max-w-2xl',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-6 py-4">
          <div className="min-w-0">
            <h3 id="modal-title" className="font-display text-lg font-semibold text-slate-100">
              {title}
            </h3>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
