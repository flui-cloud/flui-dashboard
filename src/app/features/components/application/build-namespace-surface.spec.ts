import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import { clusterEntityRef } from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from './application-surface';
import {
  BuildNamespaceSurfaceInput,
  BuildNamespaceSurfaceRevision,
  buildBuildNamespaceSurface,
  presentedContent,
} from './build-namespace-surface';

const GENERATED_AT = '2026-09-07T16:00:00.000Z';
const CLUSTER_ID = 'cluster-1';

function resources(over: Partial<NonNullable<BuildNamespaceSurfaceInput['resources']>> = {}) {
  return {
    queued: [
      {
        buildId: 'build-1',
        applicationId: 'app-1',
        appSlug: 'demo-api',
        branch: 'main',
        commitShortSha: '4f1c8a2',
        ageMinutes: 3,
        status: 'BUILDING',
      },
    ],
    tasks: [
      {
        buildId: 'build-1',
        appSlug: 'demo-api',
        purpose: null,
        status: 'Running',
        ageMinutes: 3,
        cpuRequest: '500m',
        memoryRequest: '1Gi',
      },
    ],
    workers: [
      { buildId: 'build-1', appSlug: 'demo-api', phase: 'Running', ageMinutes: 3, containerCount: 2 },
    ],
    totalCpuRequestMillicores: 500,
    totalMemoryRequestMiB: 1024,
    ...over,
  };
}

function input(over: Partial<BuildNamespaceSurfaceInput> = {}): BuildNamespaceSurfaceInput {
  return {
    clusterCount: 2,
    selectedClusterId: CLUSTER_ID,
    selectedClusterName: 'control-cluster',
    isLoadingClusters: false,
    isLoadingResources: false,
    hasError: false,
    refused: false,
    resources: resources(),
    cleanup: { open: false, olderThanMinutes: 0, running: false, previewTaskCount: null, previewWorkerCount: null },
    ...over,
  };
}

function snapshotOf(over: Partial<BuildNamespaceSurfaceInput> = {}): SurfaceSnapshot {
  return buildBuildNamespaceSurface(input(over), { revision: 1, generatedAt: GENERATED_AT });
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('build namespace surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates with no cluster picked, while loading, refused, on error, and with cleanup open', () => {
    expectValidSurface(snapshotOf({ selectedClusterId: null, selectedClusterName: undefined, resources: null }));
    expectValidSurface(snapshotOf({ isLoadingResources: true, resources: null }));
    expectValidSurface(snapshotOf({ refused: true, resources: null }));
    expectValidSurface(snapshotOf({ hasError: true, resources: null }));
    expectValidSurface(
      snapshotOf({ cleanup: { open: true, olderThanMinutes: 30, running: false, previewTaskCount: 4, previewWorkerCount: 2 } }),
    );
  });

  // The cluster comes from a select, not from the URL: `selection` is what happened.
  it('holds the picked cluster with reason selection, and only the page when none is picked', () => {
    expect(snapshotOf().attention).toEqual([
      { scopeId: 'build-queue', entityRef: clusterEntityRef(CLUSTER_ID), reason: 'selection' },
    ]);
    expect(scope(snapshotOf(), 'build-queue')!.entities![0].role).toBe('primary');
    const none = snapshotOf({ selectedClusterId: null, selectedClusterName: undefined, resources: null });
    expect(none.attention).toEqual([{ scopeId: 'build-queue', reason: 'route' }]);
    expect(scope(none, 'build-queue')!.entities).toBeUndefined();
  });

  it('claims no table before a cluster is picked or before its resources arrive', () => {
    expect(snapshotOf({ resources: null }).scopes.map((s) => s.id)).toEqual(['build-queue']);
  });

  it('gives a queued build the application it is for, never a queue-entry id nobody can act on', () => {
    const row = scope(snapshotOf(), 'build-queue:queue:build-1')!;
    expect(row.entities).toEqual([{ ref: applicationEntityRef('app-1'), label: 'demo-api', role: 'related' }]);
    expect(row.observations!.find((o) => o.key === 'flui.build.status')!.presentedAs.text).toBe('BUILDING');
    expect(row.observations!.find((o) => o.key === 'flui.build.age_minutes')!.presentedAs).toEqual({ value: 3, unit: 'min' });
  });

  it('gives tasks and workers no entity at all — a Job and a Pod are platform plumbing', () => {
    const task = scope(snapshotOf(), 'build-queue:tasks:0:build-1')!;
    const worker = scope(snapshotOf(), 'build-queue:workers:0:build-1')!;
    expect(task.entities).toBeUndefined();
    expect(worker.entities).toBeUndefined();
    expect(task.label).toBe('demo-api');
    expect(worker.observations!.find((o) => o.key === 'flui.build_worker.containers')!.presentedAs.value).toBe(2);
  });

  it('carries a refusal as an observation, not as a broken view', () => {
    const snapshot = snapshotOf({ refused: true, resources: null });
    expect(obsOf(snapshot, 'build-queue', 'flui.build_queue.refused')!.presentedAs.value).toBe(true);
    expect(scope(snapshot, 'build-queue')!.state).toEqual({ loading: false });
  });

  it('reports a real load failure as a coded view error', () => {
    expect(scope(snapshotOf({ hasError: true, resources: null }), 'build-queue')!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.build_queue.load_failed',
    });
  });

  it('says an empty table is empty instead of dropping it', () => {
    const snapshot = snapshotOf({ resources: resources({ queued: [], tasks: [], workers: [] }) });
    expect(scope(snapshot, 'build-queue:queue')!.state).toEqual({ loading: false, empty: true });
    expect(scope(snapshot, 'build-queue:queue')!.completeness).toEqual({ shown: 0, total: 0 });
  });

  it('moves attention onto the cleanup panel while it is open, and counts its preview only', () => {
    const snapshot = snapshotOf({
      cleanup: { open: true, olderThanMinutes: 30, running: false, previewTaskCount: 4, previewWorkerCount: 2 },
    });
    expect(snapshot.attention).toEqual([{ scopeId: 'build-queue:cleanup', reason: 'active-view' }]);
    expect(obsOf(snapshot, 'build-queue:cleanup', 'flui.build_queue.cleanup_preview_tasks')!.presentedAs.value).toBe(4);
    expect(obsOf(snapshot, 'build-queue:cleanup', 'flui.build_queue.cleanup_preview_workers')!.presentedAs.value).toBe(2);
  });

  // Playbook §7, last item, and this repo's own docs policy on Kubernetes primitives.
  it('redacts: no Job name, no Pod name, no container name, no namespace', () => {
    const json = JSON.stringify(
      snapshotOf({
        cleanup: { open: true, olderThanMinutes: 0, running: false, previewTaskCount: 1, previewWorkerCount: 1 },
      }),
    );
    // The input type carries no field that could hold one, so the redaction is structural:
    // there is nowhere for a Job name, a Pod name or a container name to enter from.
    expect(json).not.toContain('flui-build-job-');
    expect(json).not.toContain('build-pod-');
    expect(json).not.toContain('kaniko');
    expect(json).not.toContain('deletedJobs');
    expect(json).not.toContain('deletedPods');
    expect(json).not.toContain('flui-builds');
  });

  it('caps very long tables and says so on the snapshot too', () => {
    const workers = Array.from({ length: 40 }, (_, i) => ({
      buildId: `build-${i}`,
      appSlug: `app-${i}`,
      phase: 'Running',
      ageMinutes: i,
      containerCount: 1,
    }));
    const snapshot = snapshotOf({ resources: resources({ workers }) });
    expect(scope(snapshot, 'build-queue:workers')!.completeness).toEqual({ shown: 25, total: 40, truncated: true });
    expect(snapshot.surface.truncated).toBe(true);
    expectValidSurface(snapshot);
  });

  it('bumps the revision on real change, and accepts it against the previous snapshot', () => {
    const tracker = new BuildNamespaceSurfaceRevision();
    const before = input();
    const first = buildBuildNamespaceSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT });
    const after = input({ cleanup: { open: true, olderThanMinutes: 30, running: false, previewTaskCount: null, previewWorkerCount: null } });
    const second = buildBuildNamespaceSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T16:00:05.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new BuildNamespaceSurfaceRevision();
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
