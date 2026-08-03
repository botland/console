'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Button, Card, Input, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  DEFAULT_PUBLIC_CHAT,
  VISIBILITY_LABEL,
  chatRegistrationDetail,
  chatRegistrationLabel,
  deriveChatRegistration,
  type PublicChatDraft,
  type SettingVisibility,
} from '@/lib/mock/identity-settings';

/** Settings owned on other pages — Application keeps Public chat. */
const APPLICATION_ELSEWHERE = [
  {
    category: 'Identity & IdP posture',
    examples: 'OIDC, SSO, access mode, IdP TLS trust, edge/mesh status',
    reason: 'Proof-of-user and multi-user posture — not Application product knobs.',
    home: 'Identity',
    href: '/identity',
  },
  {
    category: 'Access audit / live PEP',
    examples: 'Decision log, effective tools, ready checks',
    reason: 'Observe and prove runtime authorization.',
    home: 'Access',
    href: '/access',
  },
  {
    category: 'Hugging Face token & storage mounts',
    examples: 'HF token (real), NFS/SMB/S3/MinIO mount registry',
    reason:
      'HF token is set on Storage against the controller. MinIO mounts are S3-compatible endpoints.',
    home: 'Storage',
    href: '/storage',
  },
  {
    category: 'Connector credentials',
    examples: 'SQL DSN, S3 keys, Git remotes',
    reason: 'Product path is source instances.',
    home: 'Sources',
    href: '/packs',
  },
  {
    category: 'Agent tool-loop limits',
    examples:
      'OWNEDGE_CHAT_TOOL_MAX_ROUNDS, DEADLINE_SEC, RESULT_MAX_CHARS, TOOL_LIST_* TTLs',
    reason:
      'OwnEdge platform internals. Protect latency and model context when tools run. Not a customer admin surface.',
    home: 'Internal (platform defaults)',
  },
  {
    category: 'Bootstrap / topology / host',
    examples: 'LOCAL_NODE_*, HEAD_*, ports, SHM, image pins, gateway/DNS',
    reason: 'Install and host layout, or other console pages after first boot.',
    home: 'Install · Orchestration · System · Config',
  },
  {
    category: 'Debug / lab escapes',
    examples: 'OWNEDGE_PEP_DEBUG_RESPONSE, MCP_EASY_MODE, EXPOSE_AGENT_ROUTES',
    reason: 'Not product posture for customer admins.',
    home: 'Install .env (lab only)',
  },
] as const;

function VisibilityBadge({ kind }: { kind: SettingVisibility }) {
  const styles: Record<SettingVisibility, string> = {
    admin: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    derived: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    advanced: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    'install-only': 'border-slate-600 bg-slate-800/80 text-slate-400',
    elsewhere: 'border-slate-600 bg-slate-800/50 text-slate-500',
    status: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        styles[kind],
      )}
    >
      {VISIBILITY_LABEL[kind]}
    </span>
  );
}

function EnvHint({ envKey }: { envKey?: string }) {
  if (!envKey) return null;
  return (
    <code className="mt-1 block text-[11px] text-slate-600" title="Today’s install key (review only)">
      {envKey}
    </code>
  );
}

function FieldShell({
  label,
  description,
  visibility,
  envKey,
  children,
}: {
  label: string;
  description: string;
  visibility: SettingVisibility;
  envKey?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">{label}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          <EnvHint envKey={envKey} />
        </div>
        <VisibilityBadge kind={visibility} />
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-3">
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={onToggle}>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-slate-100">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">{description}</p>
        </div>
      </button>
      {open && <div className="grid gap-3 pt-1">{children}</div>}
    </Card>
  );
}

export default function ApplicationPage() {
  const [publicChat, setPublicChat] = useState<PublicChatDraft>(DEFAULT_PUBLIC_CHAT);
  const [publicChatOpen, setPublicChatOpen] = useState(true);
  const [elsewhereOpen, setElsewhereOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [identityAuth, setIdentityAuth] = useState<{
    authMode: 'open' | 'headers' | 'token' | 'oidc';
    ssoEnabled: boolean;
  }>({ authMode: 'open', ssoEnabled: false });

  useEffect(() => {
    api
      .getIdentity()
      .then((id) =>
        setIdentityAuth({
          authMode: id.auth_mode,
          ssoEnabled: id.sso_enabled,
        }),
      )
      .catch(() => {
        /* leave code defaults */
      });
  }, []);

  // Derived from Identity SoT (not a free toggle).
  const registration = useMemo(
    () =>
      deriveChatRegistration({
        authMode: identityAuth.authMode === 'token' ? 'open' : identityAuth.authMode,
        ssoEnabled: identityAuth.ssoEnabled,
        oidcIssuer: '',
      }),
    [identityAuth],
  );

  const mockSave = () => {
    setToast('Mock only — not applied to the appliance');
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <>
      <PageHeader
        title="Application"
        description="Product settings for the appliance chat surface and related admin knobs (mock)"
        action={
          <Button type="button" onClick={mockSave}>
            Save (mock)
          </Button>
        }
      />

      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <p className="font-medium text-amber-100">Mock surface — nothing is written to the appliance</p>
        <p className="mt-1 text-amber-200/80">
          Application owns product knobs such as public chat. Identity is a separate page (IdP /
          SSO). Storage holds HF token and mounts. Tool-loop limits stay internal.
        </p>
      </div>

      {toast && (
        <div className="mb-6 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm text-slate-200">
          {toast}
        </div>
      )}

      <div className="max-w-4xl space-y-6">
        <CollapsibleSection
          title="Public chat"
          description="Bundled chat surface. Self-registration is derived from Identity (IdP/SSO) — never a free toggle when an IdP is present."
          open={publicChatOpen}
          onToggle={() => setPublicChatOpen((o) => !o)}
        >
          <FieldShell
            label="Self-registration"
            description={`${chatRegistrationDetail(registration)} Configure IdP/SSO on Identity; this value follows that posture.`}
            visibility="derived"
            envKey="(derived from Identity — not a free signup toggle)"
          >
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-medium',
                registration === 'closed'
                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
                  : 'border-slate-600 bg-slate-800 text-slate-300',
              )}
            >
              {chatRegistrationLabel(registration)}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Source of truth for IdP/SSO:{' '}
              <Link href="/identity" className="text-cyan-500/90 underline hover:text-cyan-400">
                Identity
              </Link>
              .
            </p>
          </FieldShell>

          <FieldShell
            label="Public appliance URL"
            description="Used for public links and IdP redirect hosts. Install scripts often derive this from the appliance address."
            visibility="admin"
            envKey="APPLIANCE_PUBLIC_URL"
          >
            <Input
              value={publicChat.publicApplianceUrl}
              onChange={(e) =>
                setPublicChat({ ...publicChat, publicApplianceUrl: e.target.value })
              }
            />
          </FieldShell>
        </CollapsibleSection>

        <CollapsibleSection
          title="Managed elsewhere"
          description="Not Application fields — links to the pages that own them."
          open={elsewhereOpen}
          onToggle={() => setElsewhereOpen((o) => !o)}
        >
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {APPLICATION_ELSEWHERE.map((item) => (
              <li key={item.category} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-medium text-slate-200">{item.category}</div>
                  <VisibilityBadge kind="elsewhere" />
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
                <p className="mt-1 text-[11px] text-slate-600">Examples: {item.examples}</p>
                <p className="mt-1 text-xs text-cyan-500/80">
                  Home:{' '}
                  {'href' in item && item.href ? (
                    <Link href={item.href} className="underline hover:text-cyan-400">
                      {item.home}
                    </Link>
                  ) : (
                    item.home
                  )}
                </p>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>
    </>
  );
}
