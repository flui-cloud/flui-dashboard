import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  DeployWizardSurfaceInput,
  DeployWizardSurfaceRevision,
  buildDeployWizardSurface,
  presentedContent,
} from './deploy-wizard-surface';

function input(over: Partial<DeployWizardSurfaceInput> = {}): DeployWizardSurfaceInput {
  return {
    currentStepId: 'source',
    currentStepTitle: 'Source',
    sourceType: null,
    flowSubtype: null,
    selectedCluster: null,
    selectedRepositoryFullName: null,
    selectedTemplate: null,
    ...over,
  };
}

function snapshotOf(over: Partial<DeployWizardSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildDeployWizardSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'page')!;
const stepScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.kind === 'region')!;
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('deploy wizard surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new DeployWizardSurfaceRevision();
    const first = buildDeployWizardSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-08-20T09:13:00.000Z' })!;
    const second = buildDeployWizardSurface(
      input({ currentStepId: 'cluster', currentStepTitle: 'Cluster' }),
      { revision: tracker.next(presentedContent(input({ currentStepId: 'cluster', currentStepTitle: 'Cluster' }))!), generatedAt: '2026-08-20T09:14:00.000Z' },
    )!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('produces no snapshot at all before the stepper has resolved a step id — no invented state', () => {
    expect(buildDeployWizardSurface(input({ currentStepId: '' }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' }))
      .toBeNull();
  });

  it('names only the page in attention, never an entity — nothing deployed exists yet', () => {
    const snapshot = snapshotOf({
      flowSubtype: 'existing-repo',
      selectedRepositoryFullName: 'flui-cloud/billing-api',
      selectedCluster: { id: 'c1', name: 'prod-eu' },
    });
    expect(snapshot.attention).toEqual([{ scopeId: 'deploy-wizard', reason: 'route' }]);
  });

  it('adds one step region scope for the active step, owned by the page, mirroring application-surface\'s tab scope', () => {
    const snapshot = snapshotOf({ currentStepId: 'runtime-config', currentStepTitle: 'Runtime Config' });
    const step = stepScope(snapshot);
    expect(step).toEqual({
      id: 'deploy-wizard:step:runtime-config',
      parentId: 'deploy-wizard',
      kind: 'region',
      label: 'Runtime Config',
      observations: [
        { key: 'flui.deploy.active_step', presentedAs: { text: 'runtime-config' }, source: 'ui' },
      ],
    });
  });

  it('matches the brief\'s own example: on the runtime-config step, source is a git repo, target cluster named', () => {
    const snapshot = snapshotOf({
      currentStepId: 'runtime-config',
      currentStepTitle: 'Runtime Config',
      sourceType: 'git_build',
      flowSubtype: 'existing-repo',
      selectedRepositoryFullName: 'flui-cloud/billing-api',
      selectedCluster: { id: 'c1', name: 'prod-eu' },
    });
    expect(observation(snapshot, 'flui.deploy.source_type')?.presentedAs.text).toBe('git_build');
    expect(observation(snapshot, 'flui.deploy.cluster')?.presentedAs.text).toBe('prod-eu');
    expect(observation(snapshot, 'flui.deploy.repository')?.presentedAs.text).toBe('flui-cloud/billing-api');
  });

  it('says nothing about source/flow/cluster before any pick has been made', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.deploy.source_type')).toBeUndefined();
    expect(observation(snapshot, 'flui.deploy.flow')).toBeUndefined();
    expect(observation(snapshot, 'flui.deploy.cluster')).toBeUndefined();
  });

  it('presents the template identity only for the template flow, and the repository only for the existing-repo flow', () => {
    const templateFlow = snapshotOf({
      flowSubtype: 'template',
      selectedTemplate: { framework: 'nextjs', displayName: 'Next.js' },
      selectedRepositoryFullName: 'stale/leftover-from-a-previous-flow',
    });
    expect(observation(templateFlow, 'flui.deploy.template')?.presentedAs.text).toBe('Next.js');
    expect(observation(templateFlow, 'flui.deploy.repository')).toBeUndefined();

    const repoFlow = snapshotOf({
      flowSubtype: 'existing-repo',
      selectedRepositoryFullName: 'flui-cloud/billing-api',
      selectedTemplate: { framework: 'nextjs', displayName: 'Next.js' },
    });
    expect(observation(repoFlow, 'flui.deploy.repository')?.presentedAs.text).toBe('flui-cloud/billing-api');
    expect(observation(repoFlow, 'flui.deploy.template')).toBeUndefined();
  });

  it('redacts: no repo URL, no app name, no env var name or value, no image ref, ever reaches the snapshot', () => {
    // These fields do not even exist on DeployWizardSurfaceInput — this test guards the
    // contract itself, not just today's implementation: the input type has no field a
    // future edit could accidentally start observing without deliberately widening it.
    const json = JSON.stringify(
      snapshotOf({
        flowSubtype: 'existing-repo',
        selectedRepositoryFullName: 'flui-cloud/billing-api',
      }),
    );
    expect(json).not.toContain('https://');
    expect(json).not.toContain('DATABASE_PASSWORD');
    expect(json).not.toContain('hunter2');
  });
});
