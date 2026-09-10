import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { applicationEntityRef } from '../application/application-surface';
import { repositoryEntityRef } from '../application/repositories-list-surface';
import { clusterEntityRef } from '../../../shared/utils/surface-kit';
import {
  RepoMapSurfaceInput,
  RepoMapSurfaceRevision,
  buildRepoMapSurface,
  presentedContent,
} from './repo-map-surface';

const REPO_ID = 'e6d2b0f4-0c1a-4c2e-9f6d-0b1c2d3e4f50';
const CLUSTER_ID = 'cluster-7';
const GENERATED_AT = '2026-09-07T10:00:00.000Z';

type Assessment = NonNullable<RepoMapSurfaceInput['assessment']>;

function capacity(): Assessment['capacity'] {
  return {
    assessed: true,
    notAssessedReason: null,
    known: true,
    fits: true,
    requiredCpuMillicores: 500,
    requiredMemoryMebibytes: 1024,
    availableCpuMillicores: 3800,
    availableMemoryMebibytes: 7000,
    uncountedCount: 1,
  };
}

function assessment(over: Partial<Assessment> = {}): Assessment {
  return {
    coverage: 'best_effort',
    outcome: 'deployable_pending_inputs',
    outcomeLabel: 'Ready once you fill in the values below',
    unitsReady: 1,
    unitsPendingInputs: 1,
    unitsBlocked: 0,
    unitsNotAssessed: 0,
    capacity: capacity(),
    neededCount: 2,
    neededSecretCount: 1,
    neededBlocksStartCount: 1,
    externalCount: 1,
    obstacles: [],
    questionCount: 1,
    questionsWithOptionsCount: 1,
    units: [
      { id: '.', name: 'root', buildStrategy: 'dockerfile', port: 3000, readiness: 'deployable', skipped: false },
      { id: 'services/api', name: 'services/api', buildStrategy: 'nixpacks', port: null, readiness: 'deployable_pending_inputs', skipped: true },
    ],
    services: [
      { name: 'postgres', block: 'postgres' },
      { name: 'clickhouse', block: null },
    ],
    renderedUnitCount: 1,
    caveatCount: 3,
    ...over,
  };
}

function input(over: Partial<RepoMapSurfaceInput> = {}): RepoMapSurfaceInput {
  return {
    repositoryId: REPO_ID,
    repoFullName: 'flui-cloud/flui-demo-app',
    branchInput: 'main',
    branchOptionCount: 4,
    branchListingFailed: false,
    clusterIdInput: CLUSTER_ID,
    clusterName: 'control-cluster',
    hasRun: true,
    loading: false,
    hasLoadError: false,
    read: { branch: 'main', ok: true, commitShortSha: '4f1c8a20de' },
    assessment: assessment(),
    yamlExpanded: false,
    rawMapExpanded: false,
    applying: false,
    applyBlockedReason: '',
    applied: null,
    refusal: null,
    ...over,
  };
}

function snapshotOf(over: Partial<RepoMapSurfaceInput> = {}): SurfaceSnapshot {
  return buildRepoMapSurface(input(over), { revision: 1, generatedAt: GENERATED_AT })!;
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('repo map surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates in every shape this page really takes — read refused, applied, refused with strays', () => {
    expectValidSurface(snapshotOf({ read: null, assessment: null, loading: true }));
    expectValidSurface(snapshotOf({ read: { branch: 'main', ok: false, reason: 'no-credential' }, assessment: null }));
    expectValidSurface(snapshotOf({ hasLoadError: true, read: null, assessment: null }));
    expectValidSurface(
      snapshotOf({
        applied: {
          partial: true,
          branch: 'flui/deploy-4f1c8a2',
          commitShortSha: 'ab12cd34ef',
          baseBranch: 'main',
          fileCount: 4,
          skippedCount: 1,
          unmarkedCount: 1,
          units: [
            {
              unitId: '.',
              name: 'demo-app',
              applicationId: 'app-1',
              slug: 'demo-app',
              manifestPath: 'flui.yaml',
              workflowPath: '.github/workflows/flui-deploy.yml',
              status: 'created',
              armed: false,
              markedForReuse: false,
              reason: 'The webhook secret could not be written, so this unit answers its own webhook with a 401.',
            },
          ],
        },
      }),
    );
    expectValidSurface(
      snapshotOf({
        refusal: {
          status: 409,
          stranded: {
            branchDeleted: true,
            committed: false,
            markedForReuse: false,
            applications: [
              { applicationId: 'app-9', name: 'demo-api', slug: 'demo-api', unitId: '.', branch: 'flui/deploy-4f1c8a2', attachedServices: ['postgres'] },
            ],
          },
        },
      }),
    );
  });

  // The detail-page pattern of playbook §4: one real entity, named for the whole life of the
  // page, never a selection invented to make attention richer.
  it('names the repository from the route, reason route, in every state', () => {
    for (const over of [{}, { read: null, assessment: null }, { hasLoadError: true }] as Partial<RepoMapSurfaceInput>[]) {
      const snapshot = snapshotOf(over);
      expect(snapshot.attention).toEqual([
        { scopeId: 'repo-map', entityRef: repositoryEntityRef(REPO_ID), reason: 'route' },
      ]);
      expect(scope(snapshot, 'repo-map')!.entities![0].role).toBe('primary');
    }
  });

  it('does not move attention onto the loudest card on the page — a refusal that left applications behind', () => {
    const snapshot = snapshotOf({
      refusal: {
        status: 409,
        stranded: {
          branchDeleted: false,
          committed: true,
          markedForReuse: false,
          applications: [
            { applicationId: 'app-9', name: 'demo-api', slug: 'demo-api', unitId: '.', branch: 'b', attachedServices: [] },
          ],
        },
      },
    });
    expect(snapshot.attention).toEqual([
      { scopeId: 'repo-map', entityRef: repositoryEntityRef(REPO_ID), reason: 'route' },
    ]);
    expect(scope(snapshot, 'repo-map:refusal')!.state).toEqual({
      error: true,
      errorCode: 'flui.repo_map.apply_left_applications',
    });
  });

  it('emits no snapshot at all when the route names no repository', () => {
    expect(buildRepoMapSurface(input({ repositoryId: '' }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
  });

  it('shows the page loading with only its controls before the first map comes back', () => {
    const snapshot = snapshotOf({ read: null, assessment: null, loading: true, hasRun: false });
    expect(snapshot.scopes.map((s) => s.id)).toEqual(['repo-map', 'repo-map:controls']);
    expect(scope(snapshot, 'repo-map')!.state).toEqual({ loading: true });
    expect(obsOf(snapshot, 'repo-map:controls', 'flui.repo_map.has_run')!.presentedAs.value).toBe(false);
  });

  it('marks a failed call as a view error with a code, never the backend sentence', () => {
    const snapshot = snapshotOf({ hasLoadError: true, read: null, assessment: null });
    expect(scope(snapshot, 'repo-map')!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.repo_map.unreachable',
    });
  });

  // Playbook §6 point 2: a map that answers "this repository could not be read" is a complete
  // answer from the engine, not the view failing — it must not become state.error.
  it('keeps an unreadable repository out of scope.state and in an observation', () => {
    const snapshot = snapshotOf({ read: { branch: 'main', ok: false, reason: 'no-credential' }, assessment: null });
    expect(scope(snapshot, 'repo-map')!.state).toEqual({ loading: false });
    expect(obsOf(snapshot, 'repo-map', 'flui.repo_map.read_ok')!.presentedAs.value).toBe(false);
    expect(obsOf(snapshot, 'repo-map', 'flui.repo_map.read_refusal')!.presentedAs.text).toBe('no-credential');
    // Nothing below the verdict card is drawn on that screen, so nothing below it is claimed.
    expect(scope(snapshot, 'repo-map:verdict')).toBeUndefined();
    expect(scope(snapshot, 'repo-map:units')).toBeUndefined();
    expect(scope(snapshot, 'repo-map:apply')).toBeUndefined();
  });

  it('presents the verdict as its outcome and the counts behind it, not the engine reason', () => {
    const snapshot = snapshotOf();
    expect(scope(snapshot, 'repo-map:verdict')!.label).toBe('Ready once you fill in the values below');
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.outcome')!.presentedAs.text).toBe('deployable_pending_inputs');
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.units_ready')!.presentedAs.value).toBe(1);
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_fits')!.presentedAs.value).toBe(true);
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_uncounted')!.presentedAs.value).toBe(1);
  });

  it('says a capacity that was never computed was never computed, and invents no numbers', () => {
    const snapshot = snapshotOf({
      assessment: assessment({
        capacity: { assessed: false, notAssessedReason: 'cluster-unreadable', known: false, uncountedCount: 0 },
      }),
    });
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_assessed')!.presentedAs.value).toBe(false);
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_not_assessed_reason')!.presentedAs.text).toBe('cluster-unreadable');
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_fits')).toBeUndefined();
    expect(obsOf(snapshot, 'repo-map:verdict', 'flui.repo_map.capacity_required_cpu')).toBeUndefined();
  });

  it('carries the units as rows WITHOUT a flui ref — a unit is not an application yet', () => {
    const snapshot = snapshotOf();
    const root = scope(snapshot, 'repo-map:units:.')!;
    expect(root.entities).toBeUndefined();
    expect(root.label).toBe('root');
    expect(root.observations!.find((o) => o.key === 'flui.repo_map.unit_port')!.presentedAs.value).toBe(3000);
    expect(root.observations!.find((o) => o.key === 'flui.repo_map.unit_readiness')!.presentedAs.text).toBe('deployable');
  });

  it('keeps a slashed unit id out of the scope id, which the schema would reject, and still validates', () => {
    const snapshot = snapshotOf();
    expect(scope(snapshot, 'repo-map:units:services_api')).toBeTruthy();
    expect(scope(snapshot, 'repo-map:units:services_api')!.observations!.find((o) => o.key === 'flui.repo_map.unit_not_rendered')!.presentedAs.value).toBe(true);
    expectValidSurface(snapshot);
  });

  it('names the chosen cluster as a related entity on the controls, and nothing when none is chosen', () => {
    expect(scope(snapshotOf(), 'repo-map:controls')!.entities).toEqual([
      { ref: clusterEntityRef(CLUSTER_ID), label: 'control-cluster', role: 'related' },
    ]);
    const none = snapshotOf({ clusterIdInput: '', clusterName: undefined });
    expect(scope(none, 'repo-map:controls')!.entities).toBeUndefined();
    expect(obsOf(none, 'repo-map:controls', 'flui.repo_map.cluster_chosen')!.presentedAs.value).toBe(false);
  });

  it('counts what the user must provide, split the way the page tags it', () => {
    const snapshot = snapshotOf();
    expect(obsOf(snapshot, 'repo-map:needed', 'flui.repo_map.needed')!.presentedAs.value).toBe(2);
    expect(obsOf(snapshot, 'repo-map:needed', 'flui.repo_map.needed_secret')!.presentedAs.value).toBe(1);
    expect(obsOf(snapshot, 'repo-map:needed', 'flui.repo_map.needed_blocks_start')!.presentedAs.value).toBe(1);
    expect(scope(snapshot, 'repo-map:needed')!.state).toEqual({ empty: false });
  });

  it('marks the "nothing is needed" case empty instead of dropping the section the page still draws', () => {
    const snapshot = snapshotOf({
      assessment: assessment({ neededCount: 0, neededSecretCount: 0, neededBlocksStartCount: 0, externalCount: 0 }),
    });
    expect(scope(snapshot, 'repo-map:needed')!.state).toEqual({ empty: true });
  });

  it('omits the sections the page does not draw at all when they are empty', () => {
    const snapshot = snapshotOf({ assessment: assessment({ obstacles: [], questionCount: 0, questionsWithOptionsCount: 0 }) });
    expect(scope(snapshot, 'repo-map:obstacles')).toBeUndefined();
    expect(scope(snapshot, 'repo-map:questions')).toBeUndefined();
  });

  it('carries an obstacle as the unit it names and whether a fix is offered — never its prose', () => {
    const snapshot = snapshotOf({
      assessment: assessment({ obstacles: [{ hasRemedy: true, unit: 'services/api' }, { hasRemedy: false, unit: '' }] }),
    });
    expect(scope(snapshot, 'repo-map:obstacles')!.completeness).toEqual({ shown: 2, total: 2 });
    expect(scope(snapshot, 'repo-map:obstacles:0')!.observations).toEqual([
      { key: 'flui.repo_map.obstacle_unit', presentedAs: { text: 'services/api' }, source: 'api' },
      { key: 'flui.repo_map.obstacle_has_remedy', presentedAs: { value: true }, source: 'derived' },
    ]);
    expect(scope(snapshot, 'repo-map:obstacles:1')!.observations).toEqual([
      { key: 'flui.repo_map.obstacle_has_remedy', presentedAs: { value: false }, source: 'derived' },
    ]);
  });

  it('carries the one UI sentence that says why the deploy button is dead, and drops it once applied', () => {
    const blocked = snapshotOf({ applyBlockedReason: 'Pick a cluster above — an apply always deploys onto one.' });
    expect(obsOf(blocked, 'repo-map:apply', 'flui.repo_map.apply_blocked_reason')!.presentedAs.text).toBe(
      'Pick a cluster above — an apply always deploys onto one.',
    );
    expect(obsOf(snapshotOf(), 'repo-map:apply', 'flui.repo_map.apply_blocked_reason')).toBeUndefined();
  });

  it('gives every application an apply created its canonical ref, so a tool can act on it', () => {
    const snapshot = snapshotOf({
      applied: {
        partial: true,
        branch: 'flui/deploy-4f1c8a2',
        commitShortSha: 'ab12cd34ef',
        baseBranch: 'main',
        fileCount: 4,
        skippedCount: 1,
        unmarkedCount: 1,
        units: [
          {
            unitId: '.',
            name: 'demo-app',
            applicationId: 'app-1',
            slug: 'demo-app',
            manifestPath: 'flui.yaml',
            workflowPath: '.github/workflows/flui-deploy.yml',
            status: 'created',
            armed: false,
            markedForReuse: false,
            reason: 'The webhook secret could not be written.',
          },
        ],
      },
    });
    const row = scope(snapshot, 'repo-map:apply:units:.')!;
    expect(row.entities).toEqual([{ ref: applicationEntityRef('app-1'), label: 'demo-app', role: 'related' }]);
    expect(row.observations!.find((o) => o.key === 'flui.repo_map.applied_unit_armed')!.presentedAs.value).toBe(false);
    expect(row.observations!.find((o) => o.key === 'flui.repo_map.applied_unit_unmarked')!.presentedAs.value).toBe(true);
    expect(obsOf(snapshot, 'repo-map:apply', 'flui.repo_map.apply_unmarked')!.presentedAs.value).toBe(1);
  });

  it('keeps "the backend did not say" out of the marked-for-reuse warning', () => {
    const undecided = snapshotOf({
      refusal: { status: 500, stranded: { branchDeleted: false, committed: true, applications: [] } },
    });
    expect(obsOf(undecided, 'repo-map:refusal', 'flui.repo_map.refusal_marked_for_reuse')).toBeUndefined();
    const said = snapshotOf({
      refusal: { status: 500, stranded: { branchDeleted: false, committed: true, markedForReuse: false, applications: [] } },
    });
    expect(obsOf(said, 'repo-map:refusal', 'flui.repo_map.refusal_marked_for_reuse')!.presentedAs.value).toBe(false);
  });

  // Playbook §7. This page is mostly engine prose; a producer that shovelled it in would be
  // the API dump §1.3 forbids.
  it('redacts: no engine prose, no refusal message, no rendered yaml, no raw map', () => {
    const json = JSON.stringify(
      snapshotOf({
        yamlExpanded: true,
        rawMapExpanded: true,
        applied: {
          partial: true,
          branch: 'flui/deploy-4f1c8a2',
          commitShortSha: 'ab12cd34ef',
          baseBranch: 'main',
          fileCount: 2,
          skippedCount: 0,
          unmarkedCount: 0,
          units: [
            {
              unitId: '.',
              name: 'demo-app',
              applicationId: 'app-1',
              slug: 'demo-app',
              manifestPath: 'flui.yaml',
              workflowPath: '.github/workflows/flui-deploy.yml',
              status: 'created',
              armed: false,
              reason: 'THE-BACKEND-SENTENCE-ABOUT-THIS-UNIT',
              workflowRunUrl: 'https://github.com/flui-cloud/demo/actions/runs/1',
            },
          ],
        },
        refusal: {
          status: 409,
          stranded: {
            branchDeleted: false,
            committed: true,
            markedForReuse: true,
            applications: [
              {
                applicationId: 'app-9',
                name: 'demo-api',
                slug: 'demo-api',
                unitId: '.',
                branch: 'flui/deploy-4f1c8a2',
                attachedServices: ['SECRET-LOOKING-ATTACHED-SERVICE'],
              },
            ],
          },
        },
      }),
    );
    expect(json).not.toContain('THE-BACKEND-SENTENCE-ABOUT-THIS-UNIT');
    expect(json).not.toContain('SECRET-LOOKING-ATTACHED-SERVICE');
    expect(json).not.toContain('manifestPath');
    expect(json).not.toContain('workflowRunUrl');
    expect(json).not.toContain('actions/runs');
    // That the yaml and raw-map panels are OPEN is a UI fact and is carried; their content is
    // not, and the input type has no field that could carry it.
    expect(obsOf(JSON.parse(json) as SurfaceSnapshot, 'repo-map', 'flui.repo_map.yaml_shown')!.presentedAs.value).toBe(true);
    expect(json).not.toContain('apiVersion');
  });

  it('declares the truncation on the snapshot too when a very long unit list is capped', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `svc-${i}`,
      name: `svc-${i}`,
      buildStrategy: 'dockerfile',
      port: 8080,
      readiness: 'deployable',
      skipped: false,
    }));
    const snapshot = snapshotOf({ assessment: assessment({ units: many }) });
    expect(scope(snapshot, 'repo-map:units')!.completeness).toEqual({ shown: 25, total: 30, truncated: true });
    expect(snapshot.surface.truncated).toBe(true);
    expectValidSurface(snapshot);
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new RepoMapSurfaceRevision();
    const before = input();
    const first = buildRepoMapSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT })!;
    const after = input({ rawMapExpanded: true });
    const second = buildRepoMapSurface(after, { revision: tracker.next(presentedContent(after)), generatedAt: '2026-09-07T10:00:05.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new RepoMapSurfaceRevision();
    const r1 = tracker.next(presentedContent(input()));
    const r2 = tracker.next(presentedContent(input()));
    expect(r2).toBe(r1);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });
});
