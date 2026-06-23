'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  HardDrive,
  LayoutDashboard,
  Network,
  Server,
  Settings,
  Sliders,
} from 'lucide-react';

import { Logo } from '@/components/Logo';
import { WorkerBanner } from '@/components/WorkerBanner';
import { cn } from '@/lib/cn';

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/deployments', label: 'Deployments', icon: Box },
  { href: '/cluster', label: 'Cluster', icon: Network },
  { href: '/nodes', label: 'Nodes', icon: Server },
  { href: '/storage', label: 'Storage', icon: HardDrive },
  { href: '/system', label: 'System', icon: Settings },
  { href: '/config', label: 'Config', icon: Sliders },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/90 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <Logo />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
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
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          Mock console · demo cluster
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <WorkerBanner />
          {children}
        </div>
      </main>
    </div>
  );
}