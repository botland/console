'use client';

import { Button } from '@/components/ui';

export function PageLoading({ message = 'Loading…' }: { message?: string }) {
  return <div className="text-slate-500">{message}</div>;
}

export function PageError({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <p>{error}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function PageState({
  loading,
  error,
  onRetry,
  loadingMessage,
  children,
}: {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingMessage?: string;
  children: React.ReactNode;
}) {
  if (loading) return <PageLoading message={loadingMessage} />;
  if (error) return <PageError error={error} onRetry={onRetry} />;
  return <>{children}</>;
}