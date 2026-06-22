import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-800 bg-slate-900/50 p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const variants = {
    primary:
      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30',
    secondary:
      'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700',
    danger:
      'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30',
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-400">{children}</label>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}