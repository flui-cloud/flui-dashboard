import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ApplicationSurfaceInput,
  ApplicationSurfaceRevision,
  applicationEntityRef,
  buildApplicationSurface,
  presentedContent,
} from './application-surface';
import { Application, AppRuntimeResponseDto } from '../../model/application.models';
import { AppAccess } from '../../model/app-access';

const APP: Application = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  name: 'billing-api',
  slug: 'billing-api',
  category: 'user' as Application['category'],
  kind: 'APPLICATION' as Application['kind'],
  sourceType: 'docker_image' as Application['sourceType'],
  clusterId: 'cluster-1',
  k8sNamespace: 'ns-billing',
  status: 'running' as Application['status'],
  reconciliationStatus: 'IN_SYNC' as Application['reconciliationStatus'],
  sourceConfig: {},
  env: [],
  resources: {},
  scaling: {},
  replicas: 2,
  imageRef: 'registry.flui.cloud/billing-api:1.4.0',
  systemProtected: false,
  autoDeploy: false,
  deployOnPush: false,
  exposure: 'public' as Application['exposure'],
  workloadKind: 'Deployment' as Application['workloadKind'],
  persistenceScope: 'shared' as Application['persistenceScope'],
  allowMasterPlacement: false,
  labels: {},
  metadata: {},
  lastDeployedAt: '2026-08-20T09:12:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-20T09:12:00.000Z',
};

const RUNTIME: AppRuntimeResponseDto = {
  appId: APP.id,
  deploymentName: 'billing-api',
  namespace: 'ns-billing',
  replicas: { desired: 2, ready: 2, available: 2, unavailable: 0, updated: 2 },
  containers: [
    {
      name: 'billing-api',
      image: 'registry.flui.cloud/billing-api:1.4.0@sha256:abc123',
      requests: { cpu: '250m', memory: '256Mi' },
      limits: { cpu: '500m', memory: '512Mi' },
    },
  ],
};

function input(over: Partial<ApplicationSurfaceInput> = {}): ApplicationSurfaceInput {
  return {
    application: APP,
    runtime: RUNTIME,
    replicaCounts: { ready: 2, desired: 2 },
    diagnosesCount: 0,
    access: null,
    activeTab: 'overview',
    ...over,
  };
}

function snapshotOf(over: Partial<ApplicationSurfaceInput> = {}): SurfaceSnapshot {
  const snapshot = buildApplicationSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
  if (!snapshot) throw new Error('the producer described nothing');
  return snapshot;
}

const pageScope = (snapshot: SurfaceSnapshot) => snapshot.scopes.find((s) => s.id.startsWith('app-detail:') && s.kind === 'page')!;
const observation = (snapshot: SurfaceSnapshot, key: string) =>
  pageScope(snapshot).observations?.find((o) => o.key === key);

describe('application surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new ApplicationSurfaceRevision();
    const first = buildApplicationSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-08-20T09:13:00.000Z' })!;
    const second = buildApplicationSurface(
      input({ diagnosesCount: 1 }),
      { revision: tracker.next(presentedContent(input({ diagnosesCount: 1 }))!), generatedAt: '2026-08-20T09:14:00.000Z' },
    )!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when only an unpresented input field changes', () => {
    // `replicas.available`/`.updated` and `deploymentName` are on AppRuntimeResponseDto
    // but never read by pageObservations() — only replicaCounts (a separate input) and
    // containers[0]'s image/requests/limits are presented.
    const tracker = new ApplicationSurfaceRevision();
    const a = input({ runtime: { ...RUNTIME, deploymentName: 'billing-api', replicas: { ...RUNTIME.replicas, available: 2 } } });
    const b = input({ runtime: { ...RUNTIME, deploymentName: 'billing-api-canary', replicas: { ...RUNTIME.replicas, available: 1 } } });
    const r1 = tracker.next(presentedContent(a)!);
    const r2 = tracker.next(presentedContent(b)!);
    expect(r2).toBe(r1);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('claims the page and the application itself, with reason route', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `app-detail:${APP.id}`, entityRef: applicationEntityRef(APP.id), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([
      { ref: applicationEntityRef(APP.id), label: APP.name, role: 'primary' },
    ]);
  });

  it('adds one tab scope for the active tab, owned by the page scope', () => {
    const snapshot = snapshotOf({ activeTab: 'monitoring' });
    const tab = snapshot.scopes.find((s) => s.kind === 'region');
    expect(tab).toEqual({
      id: `app-detail:${APP.id}:tab:monitoring`,
      parentId: `app-detail:${APP.id}`,
      kind: 'region',
      label: 'Monitoring',
      observations: [
        { key: 'flui.application.active_tab', presentedAs: { text: 'monitoring' }, source: 'ui' },
      ],
    });
  });

  it('adds no tab scope when the router reports none', () => {
    const snapshot = snapshotOf({ activeTab: null });
    expect(snapshot.scopes.length).toBe(1);
  });

  it('presents the replica counts, image and resource requests actually shown on screen', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.application.replicas_ready')?.presentedAs).toEqual({ value: 2 });
    expect(observation(snapshot, 'flui.application.replicas_desired')?.presentedAs).toEqual({ value: 2 });
    expect(observation(snapshot, 'flui.application.image')?.presentedAs.text)
      .toBe('registry.flui.cloud/billing-api:1.4.0@sha256:abc123');
    expect(observation(snapshot, 'flui.application.cpu_request')?.presentedAs.text).toBe('250m');
    expect(observation(snapshot, 'flui.application.memory_limit')?.presentedAs.text).toBe('512Mi');
  });

  it('falls back to the application imageRef when no runtime container is loaded yet', () => {
    const snapshot = snapshotOf({ runtime: null });
    expect(observation(snapshot, 'flui.application.image')?.presentedAs.text).toBe(APP.imageRef);
    expect(observation(snapshot, 'flui.application.cpu_request')).toBeUndefined();
  });

  it('says nothing about the diagnoses badge when the count is zero, and something when it is not', () => {
    expect(observation(snapshotOf({ diagnosesCount: 0 }), 'flui.application.diagnoses_count')).toBeUndefined();
    expect(observation(snapshotOf({ diagnosesCount: 3 }), 'flui.application.diagnoses_count')?.presentedAs.value).toBe(3);
  });

  it('names the access banner the page actually shows, and nothing for full access', () => {
    const showcase: AppAccess = { tabs: [], readOnly: true, showcase: true };
    const readOnly: AppAccess = { tabs: [], readOnly: true, showcase: false };
    expect(observation(snapshotOf({ access: showcase }), 'flui.application.access_mode')?.presentedAs.text).toBe('showcase');
    expect(observation(snapshotOf({ access: readOnly }), 'flui.application.access_mode')?.presentedAs.text).toBe('read-only');
    expect(observation(snapshotOf({ access: null }), 'flui.application.access_mode')).toBeUndefined();
  });

  it('never sets scope.state from the application\'s own status — that is a view-loaded/failed flag, not domain health (§4.3); status is carried as an observation instead', () => {
    const failed = { ...APP, status: 'failed' as Application['status'] };
    expect(pageScope(snapshotOf({ application: failed })).state).toBeUndefined();
    expect(pageScope(snapshotOf()).state).toBeUndefined();
    expect(observation(snapshotOf({ application: failed }), 'flui.application.status')?.presentedAs.text).toBe('failed');
  });

  it('produces no snapshot at all when there is no application loaded — no invented selection', () => {
    expect(buildApplicationSurface(input({ application: null }), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' }))
      .toBeNull();
  });

  it('redacts: no environment values, no raw reconciliation text, no ids beyond the entity ref reach the snapshot', () => {
    const withSecrets: Application = {
      ...APP,
      env: ['DATABASE_PASSWORD=hunter2'],
      reconciliationError: 'panic: leaked token sk_live_ABC123 while dialing',
      status: 'failed' as Application['status'],
    };
    const json = JSON.stringify(snapshotOf({ application: withSecrets }));
    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('sk_live_ABC123');
    expect(json).not.toContain('DATABASE_PASSWORD');
  });
});
