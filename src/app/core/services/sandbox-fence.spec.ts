import { fenceAllows, parseFenceRule, visitorMustSignIn } from './sandbox-fence';

describe('sandbox fence in the dashboard', () => {
  const rules = [
    'GET /applications/:id',
    'GET /applications/:id/**',
    'GET /observability/applications/:id/logs',
    'POST /catalog/install',
  ]
    .map(parseFenceRule)
    .filter((r) => r !== null);

  it('admits what the API lists, with any value for a parameter', () => {
    expect(fenceAllows(rules, 'GET', '/applications/abc')).toBeTrue();
    expect(fenceAllows(rules, 'GET', '/observability/applications/abc/logs?tail=500')).toBeTrue();
    expect(fenceAllows(rules, 'POST', '/catalog/install')).toBeTrue();
  });

  it('reads ** as one or more segments, the way the API does', () => {
    expect(fenceAllows(rules, 'GET', '/applications/abc/revisions')).toBeTrue();
  });

  it('refuses another verb, another path, or a longer one', () => {
    expect(fenceAllows(rules, 'DELETE', '/applications/abc')).toBeFalse();
    expect(fenceAllows(rules, 'GET', '/platform/updates')).toBeFalse();
    expect(fenceAllows(rules, 'GET', '/observability/applications/abc/logs/volume')).toBeFalse();
  });

  it('lets HEAD through wherever GET is', () => {
    expect(fenceAllows(rules, 'HEAD', '/applications/abc')).toBeTrue();
  });
});

describe('what a visitor who has not signed in may send', () => {
  const visitorRules = ['POST /sandbox/visitor/**', 'POST /auth/oidc-session']
    .map(parseFenceRule)
    .filter((r) => r !== null);

  it('reads anything', () => {
    expect(visitorMustSignIn(visitorRules, 'GET', '/applications/abc')).toBeFalse();
    expect(visitorMustSignIn(visitorRules, 'head', '/catalog')).toBeFalse();
  });

  it('writes only where a rule is marked for visitors', () => {
    expect(visitorMustSignIn(visitorRules, 'POST', '/auth/oidc-session')).toBeFalse();
    expect(visitorMustSignIn(visitorRules, 'POST', '/sandbox/visitor/admission')).toBeFalse();
    expect(visitorMustSignIn(visitorRules, 'POST', '/catalog/install')).toBeTrue();
    expect(visitorMustSignIn(visitorRules, 'DELETE', '/auth/oidc-session')).toBeTrue();
  });
});
