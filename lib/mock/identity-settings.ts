/**
 * Mock inventory for console Identity (and related token drafts used by Storage).
 *
 * Not wired to the appliance — review surface only.
 */

export type SettingVisibility =
  | 'admin'
  | 'derived'
  | 'advanced'
  | 'install-only'
  | 'elsewhere'
  | 'status';

export type AuthMode = 'open' | 'headers' | 'oidc';
export type PepMode = 'soft' | 'strict';
export type ChatRegistration = 'closed' | 'open_possible';
/** How OwnEdge trusts the IdP HTTPS certificate (JWKS/discovery). Not JWT signature verify. */
export type OidcTlsTrust = 'system_cas' | 'custom_ca' | 'insecure_lab';

export type IdentityDraft = {
  authMode: AuthMode;
  pepMode: PepMode;
  ssoElevatesPep: boolean;
  ssoEnabled: boolean;
  /** JWT signature verification against JWKS (token crypto). */
  oidcVerify: boolean;
  oidcIssuer: string;
  oidcAudience: string;
  oidcJwksUrl: string;
  oidcClaimGroups: string;
  /** TLS to the IdP host when fetching JWKS / discovery. */
  oidcTlsTrust: OidcTlsTrust;
  /** PEM when oidcTlsTrust === custom_ca (lab.pem / private PKI). */
  oidcTlsCaPem: string;
  retrievalAclStrict: boolean;
  corpusGroupMap: string;
  edgeTrustConfigured: boolean;
  meshSecretConfigured: boolean;
};

export type PublicChatDraft = {
  publicApplianceUrl: string;
};

export type ElsewhereItem = {
  category: string;
  examples: string;
  reason: string;
  home: string;
};

/** Chat self-registration is closed when an IdP or SSO is in play. */
export function deriveChatRegistration(identity: {
  authMode: AuthMode;
  ssoEnabled: boolean;
  oidcIssuer: string;
}): ChatRegistration {
  if (identity.authMode === 'oidc') return 'closed';
  if (identity.ssoEnabled) return 'closed';
  return 'open_possible';
}

export function chatRegistrationLabel(status: ChatRegistration): string {
  return status === 'closed'
    ? 'Closed (derived)'
    : 'May follow install policy (no IdP)';
}

export function chatRegistrationDetail(status: ChatRegistration): string {
  if (status === 'closed') {
    return 'Closed when single sign-on or an identity provider is configured. Local account creation is not offered; users come from the IdP.';
  }
  return 'No IdP/SSO configured in this draft. Install-time policy may still keep registration closed. This is never a free admin toggle.';
}

export const DEFAULT_IDENTITY: IdentityDraft = {
  authMode: 'open',
  pepMode: 'soft',
  ssoElevatesPep: true,
  ssoEnabled: false,
  oidcVerify: false,
  oidcIssuer: '',
  oidcAudience: '',
  oidcJwksUrl: '',
  oidcClaimGroups: 'groups|roles|realm_access.roles',
  oidcTlsTrust: 'system_cas',
  oidcTlsCaPem: '',
  retrievalAclStrict: true,
  corpusGroupMap: '',
  edgeTrustConfigured: false,
  meshSecretConfigured: true,
};

export const OIDC_TLS_TRUST_LABEL: Record<OidcTlsTrust, string> = {
  system_cas: 'System CAs (public / OS trust store)',
  custom_ca: 'Custom CA (trust this PEM — e.g. lab.pem)',
  insecure_lab: 'Insecure — do not verify TLS (lab only)',
};

export const DEFAULT_PUBLIC_CHAT: PublicChatDraft = {
  publicApplianceUrl: 'http://localhost',
};

/** Items not on Identity — for the collapsible “Not on this page” list. */
export const ELSEWHERE_ITEMS: ElsewhereItem[] = [
  {
    category: 'Agent tool-loop limits',
    examples:
      'OWNEDGE_CHAT_TOOL_MAX_ROUNDS, DEADLINE_SEC, RESULT_MAX_CHARS, TOOL_LIST_* TTLs',
    reason:
      'OwnEdge platform internals. Protect latency and model context when tools run. Not a customer admin surface.',
    home: 'Internal (platform defaults)',
  },
  {
    category: 'Hugging Face token & storage mounts',
    examples: 'HF_TOKEN (console Storage), NFS/SMB/S3/MinIO mounts',
    reason:
      'HF token is real on Storage. MinIO is S3-compatible object storage (mount type), not the same as NFS. Bundled MinIO root password stays install-time.',
    home: 'Storage',
  },
  {
    category: 'Application inventory map',
    examples: 'Where other knobs live after the Identity/Storage split',
    reason: 'Application page remains for product inventory / residual settings map.',
    home: 'Application',
  },
  {
    category: 'Bootstrap / node identity',
    examples: 'LOCAL_NODE_ID, APPLIANCE_ID, COMPOSE_PROJECT_NAME',
    reason: 'Host install identifiers. After boot, hostname/IP are on System.',
    home: 'Install .env · System',
  },
  {
    category: 'Topology seeds',
    examples: 'HEAD_IP, HEAD_NODE_ID, SERVING_MODE, COMPUTE_BACKEND',
    reason:
      'After first boot, change via Orchestration / head migration. Editing .env has no effect unless controller data is wiped.',
    home: 'Orchestration',
  },
  {
    category: 'Ports, paths, SHM, image pins',
    examples: 'CONTROLLER_PORT, *_SHM_*, VLLM_IMAGE, chat-UI image',
    reason: 'Operator/host and release engineering — not day-to-day admin product settings.',
    home: 'Install .env',
  },
  {
    category: 'Connector credentials',
    examples: 'SQL DSN, S3 keys, Git remotes',
    reason: 'Product path is source instances.',
    home: 'Sources',
  },
  {
    category: 'Support / Config / host network',
    examples: 'SUPPORT_*, conf.json, gateway/DNS',
    reason: 'Other console pages already own these.',
    home: 'Support · Config · System',
  },
  {
    category: 'Access audit / live PEP',
    examples: 'Decision log, effective tools, ready checks',
    reason: 'Observe and prove; Identity declares posture.',
    home: 'Access',
  },
  {
    category: 'Debug / lab escapes',
    examples: 'OWNEDGE_PEP_DEBUG_RESPONSE, MCP_EASY_MODE, EXPOSE_AGENT_ROUTES',
    reason: 'Not product posture for customer admins.',
    home: 'Install .env (lab only)',
  },
  {
    category: 'Install-only API tokens',
    examples: 'CONTROLLER_API_TOKEN, retrieval token, mutation prepare token',
    reason: 'Rotate out-of-band; values never shown (edge/mesh status only on Identity).',
    home: 'Install / rotation',
  },
];

export const VISIBILITY_LABEL: Record<SettingVisibility, string> = {
  admin: 'Admin',
  derived: 'Derived',
  advanced: 'Advanced',
  'install-only': 'Install-only',
  elsewhere: 'Elsewhere',
  status: 'Status only',
};
