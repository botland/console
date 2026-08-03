import { describe, expect, it } from 'vitest';

import {
  DEFAULT_IDENTITY,
  OIDC_TLS_TRUST_LABEL,
  deriveChatRegistration,
  chatRegistrationLabel,
} from '@/lib/mock/identity-settings';

describe('deriveChatRegistration', () => {
  it('closes registration when auth mode is oidc', () => {
    expect(
      deriveChatRegistration({
        authMode: 'oidc',
        ssoEnabled: false,
        oidcIssuer: '',
      }),
    ).toBe('closed');
  });

  it('closes registration when SSO is enabled', () => {
    expect(
      deriveChatRegistration({
        authMode: 'headers',
        ssoEnabled: true,
        oidcIssuer: '',
      }),
    ).toBe('closed');
  });

  it('allows open_possible only without IdP/SSO', () => {
    expect(
      deriveChatRegistration({
        authMode: 'open',
        ssoEnabled: false,
        oidcIssuer: '',
      }),
    ).toBe('open_possible');
  });

  it('labels closed status for the UI', () => {
    expect(chatRegistrationLabel('closed')).toMatch(/Closed/i);
  });

  it('default identity draft is lab-open (registration open_possible)', () => {
    expect(deriveChatRegistration(DEFAULT_IDENTITY)).toBe('open_possible');
  });

  it('defaults IdP TLS trust to system CAs', () => {
    expect(DEFAULT_IDENTITY.oidcTlsTrust).toBe('system_cas');
    expect(OIDC_TLS_TRUST_LABEL.insecure_lab).toMatch(/lab only/i);
  });
});
