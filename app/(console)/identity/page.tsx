'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { PageState } from '@/components/PageState';
import { Button, Card, Input, PageHeader, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { IdentitySettings } from '@/lib/types';

type OidcTlsTrust = IdentitySettings['oidc_tls_trust'];

const TLS_LABEL: Record<OidcTlsTrust, string> = {
  system_cas: 'System CAs (public / OS trust store)',
  custom_ca: 'Custom CA (trust this PEM — e.g. lab.pem)',
  insecure_lab: 'Insecure — do not verify TLS (lab only)',
};

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

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

export default function IdentityPage() {
  const [draft, setDraft] = useState<IdentitySettings | null>(null);
  const [baseline, setBaseline] = useState<IdentitySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postureOpen, setPostureOpen] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .getIdentity()
      .then((doc) => {
        setDraft(doc);
        setBaseline(doc);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Failed to load identity');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = <K extends keyof IdentitySettings>(key: K, value: IdentitySettings[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveOk(null);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const saved = await api.putIdentity(draft);
      setDraft(saved);
      setBaseline(saved);
      setSaveOk('Identity saved — console is source of truth for this appliance.');
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save identity');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    draft &&
    baseline &&
    JSON.stringify({ ...draft, saved: undefined }) !==
      JSON.stringify({ ...baseline, saved: undefined });

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      {draft && (
        <>
          <PageHeader
            title="Identity"
            description="Customer identity posture — saved on the appliance (not .env)"
            action={
              <Button type="button" onClick={save} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            }
          />

          <div className="mb-6 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100/90">
            <p className="font-medium text-cyan-100">Console is the source of truth</p>
            <p className="mt-1 text-cyan-100/75">
              These settings are stored on the controller. They are not read from{' '}
              <code className="text-cyan-100/90">.env</code> for day-to-day use. Until you save once,
              code defaults apply (lab-safe open). Edge/mesh secret{' '}
              <em>values</em> remain install/rotation (status only below).
            </p>
            <p className="mt-2 text-xs text-cyan-200/70">
              Status:{' '}
              {draft.saved ? (
                <span className="text-emerald-300">Saved on appliance</span>
              ) : (
                <span className="text-amber-200">Using code defaults (not yet saved)</span>
              )}
            </p>
          </div>

          {saveOk && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
              {saveOk}
            </div>
          )}
          {saveError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {saveError}
            </div>
          )}

          <div className="max-w-4xl space-y-6">
            <CollapsibleSection
              title="Posture & IdP"
              description="How callers prove who they are and how the appliance enforces it."
              open={postureOpen}
              onToggle={() => setPostureOpen((o) => !o)}
            >
              <Field
                label="Access mode"
                description="open = lab (weak identity). headers = trusted gateway injects X-User-*. oidc = validate JWT from IdP."
              >
                <Select
                  value={draft.auth_mode}
                  onChange={(e) =>
                    patch('auth_mode', e.target.value as IdentitySettings['auth_mode'])
                  }
                >
                  <option value="open">open (lab)</option>
                  <option value="headers">headers (trusted gateway)</option>
                  <option value="oidc">oidc (JWT / IdP)</option>
                  <option value="token">token</option>
                </Select>
              </Field>

              <Field
                label="PEP mode"
                description="soft: lab residual. strict: tools require identity. Under SSO, soft elevates to strict when SSO elevates PEP is on."
              >
                <Select
                  value={draft.pep_mode}
                  onChange={(e) =>
                    patch('pep_mode', e.target.value as IdentitySettings['pep_mode'])
                  }
                >
                  <option value="off">off</option>
                  <option value="soft">soft</option>
                  <option value="strict">strict</option>
                </Select>
              </Field>

              <Field
                label="SSO elevates PEP"
                description="Product safety: when SSO is on, soft becomes effective strict so anonymous tools/call cannot pass."
              >
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={draft.sso_elevates_pep}
                    onChange={(e) => patch('sso_elevates_pep', e.target.checked)}
                  />
                  Elevate soft → strict when SSO is enabled
                </label>
              </Field>

              <Field
                label="SSO enabled"
                description="Group-based capability mapping (platform ACL). Also stored on ACL for existing PDP paths."
              >
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={draft.sso_enabled}
                    onChange={(e) => patch('sso_enabled', e.target.checked)}
                  />
                  Require / use SSO for multi-user posture
                </label>
              </Field>

              <Field
                label="JWT signature verify"
                description="Cryptographic check of access tokens against JWKS. Not the same as trusting the IdP HTTPS certificate."
              >
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={draft.oidc_verify}
                    onChange={(e) => patch('oidc_verify', e.target.checked)}
                  />
                  Verify JWT signatures (token crypto)
                </label>
              </Field>

              <Field
                label="OIDC issuer"
                description="IdP issuer URL (Entra, Keycloak realm, …)."
              >
                <Input
                  placeholder="https://keycloak.example/realms/app"
                  value={draft.oidc_issuer}
                  onChange={(e) => patch('oidc_issuer', e.target.value)}
                />
              </Field>

              <Field label="OIDC audience" description="Expected token audience.">
                <Input
                  placeholder="api://ownedge"
                  value={draft.oidc_audience}
                  onChange={(e) => patch('oidc_audience', e.target.value)}
                />
              </Field>

              <Field
                label="OIDC JWKS URL"
                description="Optional override when JWKS is not at issuer/.well-known/jwks.json."
              >
                <Input
                  placeholder="(discover from issuer)"
                  value={draft.oidc_jwks_url}
                  onChange={(e) => patch('oidc_jwks_url', e.target.value)}
                />
              </Field>

              <Field
                label="IdP TLS trust"
                description="When OwnEdge fetches JWKS over HTTPS: system CAs, trust a private CA PEM, or lab-only insecure (never production)."
              >
                <Select
                  value={draft.oidc_tls_trust}
                  onChange={(e) =>
                    patch('oidc_tls_trust', e.target.value as OidcTlsTrust)
                  }
                >
                  {(Object.keys(TLS_LABEL) as OidcTlsTrust[]).map((k) => (
                    <option key={k} value={k}>
                      {TLS_LABEL[k]}
                    </option>
                  ))}
                </Select>
                {draft.oidc_tls_trust === 'insecure_lab' && (
                  <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Disables certificate verification completely. Private lab only.
                  </p>
                )}
              </Field>

              {draft.oidc_tls_trust === 'custom_ca' && (
                <Field
                  label="Custom CA PEM"
                  description="PEM for lab.pem / private PKI. TLS is still verified against this CA."
                >
                  <textarea
                    className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    value={draft.oidc_tls_ca_pem}
                    onChange={(e) => patch('oidc_tls_ca_pem', e.target.value)}
                  />
                </Field>
              )}

              <Field
                label="Group claim path"
                description="Where groups live in the token (pipe-separated candidates). Clear for group-less SSO (F47)."
              >
                <Input
                  value={draft.oidc_claim_groups}
                  onChange={(e) => patch('oidc_claim_groups', e.target.value)}
                />
              </Field>

              <Field
                label="Subject claim path"
                description="JWT claim paths for subject (default sub)."
              >
                <Input
                  value={draft.oidc_claim_sub}
                  onChange={(e) => patch('oidc_claim_sub', e.target.value)}
                />
              </Field>

              <Field
                label="Email claim path"
                description="JWT claim paths for email (pipe-separated)."
              >
                <Input
                  value={draft.oidc_claim_email}
                  onChange={(e) => patch('oidc_claim_email', e.target.value)}
                />
              </Field>

              <Field
                label="Roles claim path"
                description="JWT claim paths for roles (pipe-separated)."
              >
                <Input
                  value={draft.oidc_claim_roles}
                  onChange={(e) => patch('oidc_claim_roles', e.target.value)}
                />
              </Field>

              <Field
                label="Tenant claim path"
                description="JWT claim paths for tenant id (pipe-separated)."
              >
                <Input
                  value={draft.oidc_claim_tenant}
                  onChange={(e) => patch('oidc_claim_tenant', e.target.value)}
                />
              </Field>

              <Field
                label="Retrieval ACL strict"
                description="Empty groups deny tagged corpus chunks (multi-user default). Saved to the appliance and pushed to the retrieval service."
              >
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={draft.retrieval_acl_strict}
                    onChange={(e) => patch('retrieval_acl_strict', e.target.checked)}
                  />
                  Deny tagged chunks when the caller has no groups
                </label>
              </Field>

              <Field
                label="Corpus path → groups"
                description="Folder prefix → group tags for RAG ACL (e.g. finance:finance|hr:hr,people)."
              >
                <Input
                  placeholder="finance:finance|hr:hr,people"
                  value={draft.corpus_group_map}
                  onChange={(e) => patch('corpus_group_map', e.target.value)}
                />
              </Field>

              <Field
                label="Edge trust secret"
                description="Install/rotation only — proves proxy→controller may carry X-User-*. Not editable here."
              >
                <div className="text-sm text-slate-300">
                  {draft.edge_trust_configured ? (
                    <span className="text-emerald-400">Configured</span>
                  ) : (
                    <span className="text-amber-400">Not configured (lab open is fine)</span>
                  )}
                </div>
              </Field>

              <Field
                label="Pack mesh secret"
                description="Install/rotation only — proves controller→packs. Must differ from edge secret in multi-user."
              >
                <div className="text-sm text-slate-300">
                  {draft.mesh_secret_configured ? (
                    <span className="text-emerald-400">Configured</span>
                  ) : (
                    <span className="text-amber-400">Not configured</span>
                  )}
                </div>
              </Field>
            </CollapsibleSection>

            {dirty && (
              <p className="text-sm text-amber-200/90">You have unsaved changes.</p>
            )}
          </div>
        </>
      )}
    </PageState>
  );
}
