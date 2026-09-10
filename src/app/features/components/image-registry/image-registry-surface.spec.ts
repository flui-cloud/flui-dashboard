import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  ImageRegistryRow,
  ImageRegistrySurfaceInput,
  ImageRegistrySurfaceRevision,
  buildImageRegistrySurface,
  imageEntityRef,
  presentedContent,
} from './image-registry-surface';

const GENERATED_AT = '2026-09-07T15:00:00.000Z';

function row(over: Partial<ImageRegistryRow> = {}): ImageRegistryRow {
  return {
    id: 'img-1',
    displayRef: 'demo-api:sha-4f1c8a2',
    commitShortSha: '4f1c8a2',
    branch: 'main',
    tagCount: 2,
    isCurrentlyDeployed: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<ImageRegistrySurfaceInput> = {}): ImageRegistrySurfaceInput {
  return {
    rows: [row(), row({ id: 'img-2', displayRef: 'demo-api:sha-9b2', commitShortSha: '9b21c0d', isCurrentlyDeployed: false })],
    totalCount: 2,
    hasSearch: false,
    hasTagFilter: false,
    isLoading: false,
    refused: false,
    hasError: false,
    confirm: null,
    actionBusy: false,
    ...over,
  };
}

function snapshotOf(over: Partial<ImageRegistrySurfaceInput> = {}): SurfaceSnapshot {
  return buildImageRegistrySurface(input(over), { revision: 1, generatedAt: GENERATED_AT });
}

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obsOf = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('image registry surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates while loading, when empty, when refused, on error, and with the dialog open', () => {
    expectValidSurface(snapshotOf({ rows: [], totalCount: 0, isLoading: true }));
    expectValidSurface(snapshotOf({ rows: [], totalCount: 0 }));
    expectValidSurface(snapshotOf({ refused: true, rows: [], totalCount: 0 }));
    expectValidSurface(snapshotOf({ hasError: true }));
    expectValidSurface(snapshotOf({ confirm: { kind: 'delete', imageId: 'img-2', label: 'demo-api:sha-9b2' }, actionBusy: true }));
  });

  it('names only the page while no dialog is open — a row acts through its own buttons', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'image-registry', reason: 'route' }]);
    expect(scope(snapshot, 'image-registry:images:img-1')!.entities![0].role).toBe('related');
  });

  it('moves attention onto the image the confirm dialog is about, and marks that row selected', () => {
    const snapshot = snapshotOf({ confirm: { kind: 'deploy', imageId: 'img-2', label: 'demo-api:sha-9b2' } });
    expect(snapshot.attention).toEqual([
      { scopeId: 'image-registry:confirm', entityRef: imageEntityRef('img-2'), reason: 'overlay' },
    ]);
    expect(scope(snapshot, 'image-registry:images:img-2')!.entities![0].role).toBe('selected');
    expect(scope(snapshot, 'image-registry:images:img-1')!.entities![0].role).toBe('related');
    expect(obsOf(snapshot, 'image-registry:confirm', 'flui.image_registry.confirm_action')!.presentedAs.text).toBe('deploy');
  });

  // The page draws the refusal in muted grey with an info icon, on purpose.
  it('carries a refusal as an observation, never as a view error', () => {
    const snapshot = snapshotOf({ refused: true, rows: [], totalCount: 0 });
    expect(obsOf(snapshot, 'image-registry', 'flui.image_registry.refused')!.presentedAs.value).toBe(true);
    expect(scope(snapshot, 'image-registry:images')!.state).toEqual({ loading: false, empty: true });
  });

  it('reports a real load failure as a coded view error', () => {
    expect(scope(snapshotOf({ hasError: true }), 'image-registry:images')!.state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.image_registry.load_failed',
      empty: false,
    });
  });

  it('carries exactly what the table prints per row, and both counts on the page', () => {
    const snapshot = snapshotOf({ hasSearch: true, totalCount: 9 });
    const first = scope(snapshot, 'image-registry:images:img-1')!;
    expect(first.label).toBe('demo-api:sha-4f1c8a2');
    expect(first.observations!.find((o) => o.key === 'flui.image.commit')!.presentedAs.text).toBe('4f1c8a2');
    expect(first.observations!.find((o) => o.key === 'flui.image.deployed')!.presentedAs.value).toBe(true);
    expect(first.observations!.find((o) => o.key === 'flui.image.tags')!.presentedAs.value).toBe(2);
    expect(obsOf(snapshot, 'image-registry', 'flui.image_registry.total')!.presentedAs.value).toBe(9);
    expect(scope(snapshot, 'image-registry:images')!.completeness).toEqual({ shown: 2, total: 2, filtered: true });
  });

  // Playbook §6 point 4: an unclassified registry path does not travel.
  it('redacts: the full registry reference and the full commit sha never reach the snapshot', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('ghcr.io');
    expect(json).not.toContain('imageRef');
    expect(json).not.toContain('githubPackageId');
  });

  it('caps a very long list and says so on the snapshot too', () => {
    const rows = Array.from({ length: 40 }, (_, i) => row({ id: `img-${i}`, displayRef: `demo:sha-${i}` }));
    const snapshot = snapshotOf({ rows, totalCount: 40 });
    expect(scope(snapshot, 'image-registry:images')!.completeness).toEqual({ shown: 25, total: 40, truncated: true });
    expect(snapshot.surface.truncated).toBe(true);
    expectValidSurface(snapshot);
  });

  it('bumps the revision on real change, and accepts it against the previous snapshot', () => {
    const tracker = new ImageRegistrySurfaceRevision();
    const before = input();
    const first = buildImageRegistrySurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT });
    const after = input({ confirm: { kind: 'delete', imageId: 'img-2', label: 'demo-api:sha-9b2' } });
    const second = buildImageRegistrySurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-09-07T15:00:05.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does NOT bump the revision when nothing presented actually changed', () => {
    const tracker = new ImageRegistrySurfaceRevision();
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
