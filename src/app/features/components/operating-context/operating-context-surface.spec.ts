import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  OperatingContextSurfaceInput,
  OperatingContextSurfaceRevision,
  buildOperatingContextSurface,
  contextNoteEntityRef,
  presentedContent,
} from './operating-context-surface';
import { ContextEntry } from '../../model/operating-context.models';

function entry(over: Partial<ContextEntry> = {}): ContextEntry {
  return {
    id: 'entry-1',
    scopeType: 'global',
    nature: 'practice',
    topic: 'master-node-scaling',
    title: 'The master is not resized',
    body: 'The API runs on it, so resizing takes the control plane down. Add workers instead.',
    confidence: 'checked',
    checkedBy: 'attestation',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  };
}

function input(over: Partial<OperatingContextSurfaceInput> = {}): OperatingContextSurfaceInput {
  return {
    loading: false,
    hasError: false,
    firstRun: false,
    focusSlug: '',
    focusClusterId: '',
    clusterNames: {},
    activeTab: 'holding',
    writeRefused: false,
    review: [],
    holding: [],
    conflicts: [],
    conflictsUnread: false,
    archive: { loading: false, hasError: false, entries: [] },
    ...over,
  };
}

function snapshotOf(over: Partial<OperatingContextSurfaceInput> = {}): SurfaceSnapshot {
  return buildOperatingContextSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((sc) => sc.id === 'operating-context')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('operating context surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks, across the real states', () => {
    expectValidSurface(snapshotOf({ activeTab: 'holding', holding: [entry()] }));
    expectValidSurface(
      snapshotOf({
        activeTab: 'attention',
        review: [entry({ id: 'r1', confidence: 'stale' })],
        conflicts: [{ topic: 'master-node-scaling', entries: [entry({ id: 'c1' }), entry({ id: 'c2' })] }],
      }),
    );
    expectValidSurface(
      snapshotOf({
        activeTab: 'archive',
        archive: { loading: false, hasError: false, entries: [entry({ id: 'a1', archivedAt: '2026-08-01T00:00:00.000Z' })] },
      }),
    );
    expectValidSurface(snapshotOf({ loading: true }));
    expectValidSurface(snapshotOf({ firstRun: true }));
    expectValidSurface(snapshotOf({ hasError: true }));
    expectValidSurface(
      snapshotOf({ focusClusterId: 'cluster-1', focusClusterName: 'production-hz', focusSlug: 'my-app' }),
    );
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(
      snapshotOf({
        activeTab: 'attention',
        review: [entry()],
        conflicts: [{ topic: 'master-node-scaling', entries: [entry({ id: 'c1' }), entry({ id: 'c2' })] }],
      }),
    );
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new OperatingContextSurfaceRevision();
    const a = input();
    const b = input({ activeTab: 'attention' });
    const first = buildOperatingContextSurface(a, {
      revision: tracker.next(presentedContent(a)),
      generatedAt: '2026-09-02T09:00:00.000Z',
    });
    const second = buildOperatingContextSurface(b, {
      revision: tracker.next(presentedContent(b)),
      generatedAt: '2026-09-02T09:01:00.000Z',
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

  it('names only the page in attention — this is a list page without a real selection', () => {
    const snapshot = snapshotOf({
      activeTab: 'attention',
      review: [entry()],
      focusClusterId: 'cluster-1',
      focusClusterName: 'production-hz',
    });
    expect(snapshot.attention).toEqual([{ scopeId: 'operating-context', reason: 'route' }]);
  });

  it('carries the focused cluster as a related entity on the page, but never the free-typed application slug as a ref', () => {
    const snapshot = snapshotOf({ focusClusterId: 'cluster-1', focusClusterName: 'production-hz', focusSlug: 'maybe-typo' });
    expect(pageScope(snapshot).entities).toEqual([
      { ref: 'flui://cluster/cluster-1', label: 'production-hz', role: 'related' },
    ]);
    expect(observation(snapshot, 'flui.operating_context.focus_slug')?.presentedAs.text).toBe('maybe-typo');
    expect(JSON.stringify(snapshot)).not.toContain('flui://application/maybe-typo');
  });

  it('marks first-run as a real empty state, not a loading gap', () => {
    const snapshot = snapshotOf({ firstRun: true });
    expect(observation(snapshot, 'flui.operating_context.first_run')?.presentedAs.value).toBe(true);
    expect(pageScope(snapshot).state).toEqual({ loading: false, empty: true });
  });

  it('presents whether writing is refused here — a refusal, never a view error', () => {
    expect(observation(snapshotOf({ writeRefused: true }), 'flui.operating_context.write_refused')?.presentedAs.value).toBe(true);
    expect(observation(snapshotOf({ writeRefused: false }), 'flui.operating_context.write_refused')?.presentedAs.value).toBe(false);
  });

  it('shows the two tab badges regardless of which tab is open, once the tab bar itself is on screen', () => {
    const snapshot = snapshotOf({
      activeTab: 'holding',
      review: [entry({ id: 'r1' })],
      holding: [entry({ id: 'h1' }), entry({ id: 'h2' })],
      conflicts: [{ topic: 'x', entries: [entry({ id: 'c1' }), entry({ id: 'c2' })] }],
    });
    expect(observation(snapshot, 'flui.operating_context.needs_look_badge')?.presentedAs.value).toBe(2);
    expect(observation(snapshot, 'flui.operating_context.holding_badge')?.presentedAs.value).toBe(2);
  });

  it('omits the tab badges while loading or on first run — the tab bar is not on screen yet', () => {
    expect(snapshotOf({ loading: true }).scopes[0].observations?.some((o) => o.key.endsWith('_badge'))).toBeFalse();
    expect(snapshotOf({ firstRun: true }).scopes[0].observations?.some((o) => o.key.endsWith('_badge'))).toBeFalse();
  });

  it('emits only the active tab\'s own list scopes — the other tabs\' notes are not on screen', () => {
    const onHolding = snapshotOf({ activeTab: 'holding', holding: [entry()] });
    expect(onHolding.scopes.some((s) => s.id === 'operating-context:holding')).toBeTrue();
    expect(onHolding.scopes.some((s) => s.id === 'operating-context:review')).toBeFalse();
    expect(onHolding.scopes.some((s) => s.id === 'operating-context:conflicts')).toBeFalse();
    expect(onHolding.scopes.some((s) => s.id === 'operating-context:archive')).toBeFalse();

    const onAttention = snapshotOf({ activeTab: 'attention', review: [entry()] });
    expect(onAttention.scopes.some((s) => s.id === 'operating-context:review')).toBeTrue();
    expect(onAttention.scopes.some((s) => s.id === 'operating-context:conflicts')).toBeTrue();
    expect(onAttention.scopes.some((s) => s.id === 'operating-context:holding')).toBeFalse();
  });

  it('presents one note\'s topic/validity/nature/check-kind/body, referencing it by a stable ref', () => {
    const snapshot = snapshotOf({
      activeTab: 'holding',
      holding: [entry({ id: 'h1', confidence: 'stale', nature: 'rationale', checkedBy: 'probe' })],
    });
    const row = snapshot.scopes.find((s) => s.id === 'operating-context:holding:h1')!;
    expect(row.entities).toEqual([{ ref: contextNoteEntityRef('h1'), label: 'The master is not resized', role: 'related' }]);
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.text ?? o.presentedAs.value]));
    expect(obs['flui.operating_context.topic']).toBe('master-node-scaling');
    expect(obs['flui.operating_context.validity']).toBe('stale');
    expect(obs['flui.operating_context.nature']).toBe('rationale');
    expect(obs['flui.operating_context.check_kind']).toBe('probe');
    expect(obs['flui.operating_context.body']).toContain('resizing takes the control plane down');
  });

  it('names a cluster-scoped note\'s cluster the same way the card does — by name, falling back to the id only when the name is not known', () => {
    const known = snapshotOf({
      activeTab: 'holding',
      holding: [entry({ id: 'h1', scopeType: 'cluster', scopeRef: 'cluster-1' })],
      clusterNames: { 'cluster-1': 'production-hz' },
    });
    const knownRow = known.scopes.find((s) => s.id === 'operating-context:holding:h1')!;
    expect(knownRow.observations!.find((o) => o.key === 'flui.operating_context.scope_cluster')?.presentedAs.text).toBe(
      'production-hz',
    );

    const unknown = snapshotOf({
      activeTab: 'holding',
      holding: [entry({ id: 'h2', scopeType: 'cluster', scopeRef: 'cluster-2' })],
      clusterNames: {},
    });
    const unknownRow = unknown.scopes.find((s) => s.id === 'operating-context:holding:h2')!;
    expect(unknownRow.observations!.find((o) => o.key === 'flui.operating_context.scope_cluster')?.presentedAs.text).toBe(
      'cluster-2',
    );
  });

  it('counts how many notes under review have a fallen premise', () => {
    const snapshot = snapshotOf({
      activeTab: 'attention',
      review: [entry({ id: 'r1', confidence: 'broken' }), entry({ id: 'r2', confidence: 'stale' })],
    });
    const list = snapshot.scopes.find((s) => s.id === 'operating-context:review')!;
    expect(list.observations).toEqual([
      { key: 'flui.operating_context.review_broken_count', presentedAs: { value: 1 }, source: 'derived' },
    ]);
  });

  it('marks the conflicts list as failed-to-read, empty of entries, when the pairing could not be read — distinct from an empty page load', () => {
    const snapshot = snapshotOf({ activeTab: 'attention', conflictsUnread: true, review: [] });
    const list = snapshot.scopes.find((s) => s.id === 'operating-context:conflicts')!;
    expect(list.state).toEqual({ empty: true, error: true, errorCode: 'flui.operating_context.conflicts_unread' });
    expect(pageScope(snapshot).state?.error).toBeUndefined();
  });

  it('presents the archive list\'s own loading/error/empty states', () => {
    const loading = snapshotOf({ activeTab: 'archive', archive: { loading: true, hasError: false, entries: [] } });
    expect(loading.scopes.find((s) => s.id === 'operating-context:archive')!.state).toEqual({ loading: true, empty: true });

    const failed = snapshotOf({ activeTab: 'archive', archive: { loading: false, hasError: true, entries: [] } });
    expect(failed.scopes.find((s) => s.id === 'operating-context:archive')!.state).toEqual({
      loading: false,
      empty: true,
      error: true,
      errorCode: 'flui.operating_context.archive_load_failed',
    });
  });

  it('shows nothing archive-related when writing here is refused, even on the archive tab — the page hides that whole section', () => {
    const snapshot = snapshotOf({
      activeTab: 'archive',
      writeRefused: true,
      archive: { loading: false, hasError: false, entries: [entry({ id: 'a1' })] },
    });
    expect(snapshot.scopes.some((s) => s.id === 'operating-context:archive')).toBeFalse();
  });

  it('redacts: no written-by/confirmed-by/retired-by person name reaches the snapshot', () => {
    const snapshot = snapshotOf({
      activeTab: 'holding',
      holding: [
        entry({
          id: 'h1',
          writtenBy: { name: 'Ada Lovelace', isYou: false },
          confirmedBy: { name: 'Grace Hopper', isYou: false },
        }),
      ],
    });
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('Ada Lovelace');
    expect(json).not.toContain('Grace Hopper');
    expect(json).not.toContain('writtenBy');
    expect(json).not.toContain('confirmedBy');
  });
});
