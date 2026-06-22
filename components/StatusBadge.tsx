import { cn } from '@/lib/cn';
import type { ApplianceState, DeploymentStatus, NodeStatus } from '@/lib/types';

const applianceColors: Record<ApplianceState, string> = {
  READY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  RECONCILING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DEGRADED: 'bg-red-500/15 text-red-400 border-red-500/30',
  BOOT: 'bg-slate-500/15 text-slate-400 border-slate-600/30',
};

const deploymentColors: Record<DeploymentStatus, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  reconciling: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  degraded: 'bg-red-500/15 text-red-400 border-red-500/30',
  stopped: 'bg-slate-500/15 text-slate-400 border-slate-600/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const nodeColors: Record<NodeStatus, string> = {
  online: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  offline: 'bg-slate-500/15 text-slate-400 border-slate-600/30',
  degraded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export function Badge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium capitalize',
        colorClass,
      )}
    >
      {label}
    </span>
  );
}

export function ApplianceBadge({ state }: { state: ApplianceState }) {
  return <Badge label={state.toLowerCase()} colorClass={applianceColors[state]} />;
}

export function DeploymentBadge({ status }: { status: DeploymentStatus }) {
  return <Badge label={status} colorClass={deploymentColors[status]} />;
}

export function NodeBadge({ status }: { status: NodeStatus }) {
  return <Badge label={status} colorClass={nodeColors[status]} />;
}