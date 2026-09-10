import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { clusterEntityRef } from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from './application-surface';
import { appGroupEntityRef } from './applications-list-surface';
import {
  AppRecapSurfaceInput,
  AppRecapSurfaceRevision,
  buildAppRecapSurface,
  presentedContent,
} from './app-recap-surface';

const GENERATED_AT = '2026-09-07T17:00:00.000Z';
const GROUP_ID = 'grp-7';
const PAGE_ID = `app-recap:${GROUP_ID}`;

function input(over: Partial<AppRecapSurfaceInput> = {}): AppRecapSurfaceInput {
  return {
    groupId: GROUP_ID,
    group: {
      id: GROUP_ID,
      name: 'demo-api',
      type: 'standalone',
      status: 'running',
      category: 'backend',
      createdAt: '2026-09-01T09:00:00.000Z',
      clusterId: 'cluster-1',
      clusterName: 'control-cluster',
    },
    primary: {
      id: 'app-1',
      slug: 'demo-api',
      kindLabel: 'Application',
      sourceLabel: 'GitHub',
      exposure: 'public',
      replicas: 2,
      catalogVersion: undefined,
    },
    accessKind: 'web',
    notFound: false,
    isLoading: false,
    extraDatabases: [],
    ...over,
  };
}

function snapshotOf(over: Partial<AppRecapSurfaceInput> = {}): SurfaceSnapshot {
  return buildAppRecapSurface(input(over), { revision: 1, generatedAt: GENERATED_AT })!;
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('app recap surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates for a database recap, a composed bundle, and the not-found card', () => {
    expectValidSurface(snapshotOf({ accessKind: 'db' }));
    expectValidSurface(
      snapshotOf({
        group: { id: GROUP_ID, name: 'immich', type: 'composed', status: 'running', category: 'photos', createdAt: '2026-09-01T09:00:00.000Z' },
        extraDatabases: [{ id: 'app-2', name: 'immich-postgres', status: 'running' }],
      }),
    );
    expectValidSurface(snapshotOf({ group: null, primary: null, notFound: true }));
  });

  it('names the app GROUP, not one of its applications — a bundle is not one app', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: PAGE_ID, entityRef: appGroupEntityRef(GROUP_ID), reason: 'route' },
    ]);
    const entities = scope(snapshot, PAGE_ID)!.entities!;
    expect(entities[0]).toEqual({ ref: appGroupEntityRef(GROUP_ID), label: 'demo-api', role: 'primary' });
    expect(entities[1]).toEqual({ ref: applicationEntityRef('app-1'), label: 'demo-api', role: 'related' });
    expect(entities[2]).toEqual({ ref: clusterEntityRef('cluster-1'), label: 'control-cluster', role: 'related' });
  });

  it('emits nothing while the applications are still arriving', () => {
    expect(buildAppRecapSurface(input({ group: null, primary: null, isLoading: true }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
    expect(buildAppRecapSurface(input({ groupId: null }), { revision: 1, generatedAt: GENERATED_AT })).toBeNull();
  });

  it('describes the not-found card once the load has finished without the group', () => {
    const snapshot = snapshotOf({ group: null, primary: null, notFound: true });
    expect(scope(snapshot, PAGE_ID)!.state).toEqual({ loading: false, error: true, errorCode: 'flui.app_recap.not_found' });
    expect(snapshot.scopes.length).toBe(1);
  });

  it('carries the facts the grid shows that a reader can act on', () => {
    const snapshot = snapshotOf();
    expect(obsOf(snapshot, PAGE_ID, 'flui.application.kind')!.presentedAs.text).toBe('Application');
    expect(obsOf(snapshot, PAGE_ID, 'flui.application.source')!.presentedAs.text).toBe('GitHub');
    expect(obsOf(snapshot, PAGE_ID, 'flui.application.exposure')!.presentedAs.text).toBe('public');
    expect(obsOf(snapshot, PAGE_ID, 'flui.application.replicas')!.presentedAs.value).toBe(2);
    expect(obsOf(snapshot, PAGE_ID, 'flui.app_recap.access_kind')!.presentedAs.text).toBe('web');
  });

  // Playbook §6 point 2: a failed workload still loaded its recap page perfectly well.
  it('keeps a failed workload out of scope.state and in its status observation', () => {
    const snapshot = snapshotOf({
      group: { id: GROUP_ID, name: 'demo-api', type: 'standalone', status: 'failed', category: 'backend', createdAt: '2026-09-01T09:00:00.000Z' },
    });
    expect(scope(snapshot, PAGE_ID)!.state).toEqual({ loading: false });
    expect(obsOf(snapshot, PAGE_ID, 'flui.application.status')!.presentedAs.text).toBe('failed');
  });

  it('lists a composed install bundled databases as real applications', () => {
    const snapshot = snapshotOf({ extraDatabases: [{ id: 'app-2', name: 'immich-postgres', status: 'running' }] });
    expect(scope(snapshot, `${PAGE_ID}:databases:app-2`)!.entities).toEqual([
      { ref: applicationEntityRef('app-2'), label: 'immich-postgres', role: 'related' },
    ]);
    expect(obsOf(snapshot, PAGE_ID, 'flui.app_recap.bundled_databases')!.presentedAs.value).toBe(true);
    expect(scope(snapshotOf(), `${PAGE_ID}:databases`)).toBeUndefined();
  });

  // Playbook §7 and §6 point 4 — the facts grid shows all of these and none of them travel.
  it('redacts: no connection coordinates, no endpoint host, no namespace, no image reference', () => {
    const json = JSON.stringify(snapshotOf({ accessKind: 'db' }));
    expect(json).not.toContain('k8sNamespace');
    expect(json).not.toContain('imageRef');
    expect(json).not.toContain('ghcr.io');
    expect(json).not.toContain('.example.com');
    expect(json).not.toContain('password');
    expect(json).not.toContain('5432');
  });

  it('bumps the revision on real change, and accepts it against the previous snapshot', () => {
    const tracker = new AppRecapSurfaceRevision();
    const before = input();
    const first = buildAppRecapSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT })!;
    const after = input({
      group: { id: GROUP_ID, name: 'demo-api', type: 'standalone', status: 'failed', category: 'backend', createdAt: '2026-09-01T09:00:00.000Z' },
    });
    const second = buildAppRecapSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T17:00:05.000Z',
    })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new AppRecapSurfaceRevision();
    expect(tracker.next(presentedContent(input()))).toBe(tracker.next(presentedContent(input())));
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });
});
