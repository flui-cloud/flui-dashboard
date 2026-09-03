import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  GithubSetupWizardSurfaceInput,
  GithubSetupWizardSurfaceRevision,
  buildGithubSetupWizardSurface,
  presentedContent,
} from './github-setup-wizard-surface';

function input(over: Partial<GithubSetupWizardSurfaceInput> = {}): GithubSetupWizardSurfaceInput {
  return {
    currentStepIndex: 0,
    selectedMethod: null,
    manualMode: false,
    configuredStatus: null,
    patValidation: null,
    hasError: false,
    ...over,
  };
}

function snapshotOf(over: Partial<GithubSetupWizardSurfaceInput> = {}): SurfaceSnapshot {
  return buildGithubSetupWizardSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.id === 'github-setup-wizard')!;
const stepScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'region')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('github setup wizard surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new GithubSetupWizardSurfaceRevision();
    const first = buildGithubSetupWizardSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ selectedMethod: 'github_app' });
    const second = buildGithubSetupWizardSurface(changed, {
      revision: tracker.next(presentedContent(changed)),
      generatedAt: '2026-09-02T09:14:00.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a singleton config wizard with no domain entity: attention names only the page', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'github-setup-wizard', reason: 'route' }]);
    expect(pageScope(snapshot).entities).toBeUndefined();
  });

  it('adds one region scope for the active step, mirroring the tab-scope pattern of application-surface.ts', () => {
    const snapshot = snapshotOf({ currentStepIndex: 1 });
    const step = stepScope(snapshot);
    expect(step.id).toBe('github-setup-wizard:step:configure');
    expect(step.parentId).toBe('github-setup-wizard');
    expect(step.label).toBe('Configure');
  });

  it('presents whether GitHub is already configured, and with which method — never a credential', () => {
    const snapshot = snapshotOf({
      configuredStatus: { configured: true, authMethod: 'github_app', appSlug: 'flui-acme' } as never,
    });
    expect(observation(snapshot, 'flui.github_setup.configured')?.presentedAs.value).toBe(true);
    expect(observation(snapshot, 'flui.github_setup.existing_auth_method')?.presentedAs.text).toBe('github_app');
    expect(observation(snapshot, 'flui.github_setup.existing_app_slug')?.presentedAs.text).toBe('flui-acme');
  });

  it('presents PAT validation outcome (login, missing-scope count) once validated, never the token', () => {
    const snapshot = snapshotOf({
      currentStepIndex: 1,
      selectedMethod: 'pat',
      patValidation: { valid: true, login: 'octocat', scopes: ['repo'], missingScopes: ['admin:repo_hook'] } as never,
    });
    const step = stepScope(snapshot);
    const obs = (key: string) => step.observations?.find((o) => o.key === key);
    expect(obs('flui.github_setup.pat_validated')?.presentedAs.value).toBe(true);
    expect(obs('flui.github_setup.pat_login')?.presentedAs.text).toBe('octocat');
    expect(obs('flui.github_setup.pat_missing_scopes_count')?.presentedAs.value).toBe(1);
  });

  it('presents manual-mode for a GitHub App configure step', () => {
    const snapshot = snapshotOf({ currentStepIndex: 1, selectedMethod: 'github_app', manualMode: true });
    const step = stepScope(snapshot);
    expect(step.observations).toEqual([
      { key: 'flui.github_setup.manual_mode', presentedAs: { value: true }, source: 'ui' },
    ]);
  });

  it('redacts: no PAT token, private key PEM, webhook secret, App name or public URL draft ever reaches the snapshot', () => {
    const json = JSON.stringify(
      snapshotOf({
        currentStepIndex: 1,
        selectedMethod: 'pat',
        patValidation: { valid: false, error: 'invalid_token' } as never,
      }),
    );
    expect(json).not.toContain('ghp_');
    expect(json).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(json).not.toContain('webhookSecret');
    expect(json).not.toContain('publicApiUrl');
  });
});
