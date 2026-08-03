'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AppWindow,
  Box,
  GitBranch,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Network,
  Package,
  Server,
  Settings,
  Shield,
  Sliders,
  LifeBuoy,
} from 'lucide-react';

import { ApplianceIdentityBar } from '@/components/ApplianceIdentityBar';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';
import { useApplianceStatus } from '@/lib/status-context';
import {
  buildConsoleContext,
  NAV_ROUTES,
  visibleNavItems,
  type ConsoleNavId,
} from '@/lib/console-capabilities';

const NAV_META: Record<
  ConsoleNavId,
  { label: string; icon: typeof LayoutDashboard }
> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  deployments: { label: 'Models', icon: Box },
  orchestration: { label: 'Orchestration', icon: Network },
  nodes: { label: 'Nodes', icon: Server },
  storage: { label: 'Storage', icon: HardDrive },
  packs: { label: 'Sources', icon: Package },
  access: { label: 'Access', icon: Shield },
  identity: { label: 'Identity', icon: KeyRound },
  application: { label: 'Application', icon: AppWindow },
  workflows: { label: 'Workflows', icon: GitBranch },
  system: { label: 'System', icon: Settings },
  support: { label: 'Support', icon: LifeBuoy },
  config: { label: 'Config', icon: Sliders },
};

/** Default nav for head / standalone before status arrives (workers refine after load). */
const DEFAULT_NAV: ConsoleNavId[] = [
  'overview',
  'deployments',
  'orchestration',
  'nodes',
  'storage',
  'packs',
  'access',
  'identity',
  'application',
  'workflows',
  'system',
  'support',
  'config',
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navIds, setNavIds] = useState<ConsoleNavId[]>(DEFAULT_NAV);
  const [footer, setFooter] = useState<string | null>(null);
  const { status } = useApplianceStatus();

  useEffect(() => {
    if (!status) {
      setFooter(null);
      return;
    }
    if (status.config?.appliance_id) {
      setFooter(status.config.appliance_id);
    }
    if (status.gateway && status.config?.cluster) {
      try {
        setNavIds(visibleNavItems(buildConsoleContext(status.gateway, status.config.cluster)));
      } catch (e) {
        console.error('Failed to resolve console nav', e);
        // Keep DEFAULT_NAV rather than blanking head-only tabs on a bad status payload.
      }
    }
  }, [status]);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <Logo />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navIds.map((id) => {
            const href = NAV_ROUTES[id];
            const meta = NAV_META[id];
            if (!href || !meta) return null;
            const { label, icon: Icon } = meta;
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        {footer && (
          <div className="p-4 border-t border-slate-800 text-xs text-slate-500">{footer}</div>
        )}
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <ApplianceIdentityBar />
          {children}
        </div>
      </main>
    </div>
  );
}