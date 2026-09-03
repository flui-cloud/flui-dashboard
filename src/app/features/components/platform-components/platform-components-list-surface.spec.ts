import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  PlatformComponentsListSurfaceInput,
  PlatformComponentsListSurfaceRevision,
  VisibleComponent,
  buildPlatformComponentsListSurface,
  platformComponentEntityRef,
  presentedContent,
} from './platform-components-list-surface';
import { PlatformComponentResponseDto } from '../../../core/api/model/platformComponentResponseDto';

function component(over: Partial<VisibleComponent> = {}): VisibleComponent {
  return {
    key: 'traefik',
    name: 'Traefik',
    description: 'Ingress controller',
    category: 'ingress',
    managedBy: PlatformComponentResponseDto.ManagedByEnum.Flui,
    status: PlatformComponentResponseDto.StatusEnum.Healthy,
    restartSupported: true,
    errorCount: 0,
    errors: [],
    resources: [],
    checkedAt: '2026-01-01T00:00:00.000Z',
    clusterId: 'cl-1',
    clusterName: 'prod',
    ...over,
  };
}

function input(over: Partial<PlatformComponentsListSurfaceInput> = {}): PlatformComponentsListSurfaceInput {
  const list = over.visibleComponents ?? [component()];
  return {
    visibleComponents: list,
    totalCount: list.length,
    isLoading: false,
    searchQuery: '',
    statusFilter: '',
    clusterFilter: '',
    expandedKeys: new Set(),
    createdAtOf: () => '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function snapshotOf(over: Partial<PlatformComponentsListSurfaceInput> = {}): SurfaceSnapshot {
  return buildPlatformComponentsListSurface(input(over), { revision: 1, generatedAt: '2026-08-20T09:13:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, clusterId: string, key: string) =>
  s.scopes.find((x) => x.id === `platform-components:components:${clusterId}:${key}`)!;

describe('platform components list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('names only the page when nothing is expanded — no invented selection', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'platform-components', reason: 'route' }]);
    expect(rowScope(snapshot, 'cl-1', 'traefik').entities![0].role).toBe('related');
  });

  it('names every expanded component in attention, reason selection — real multi-expand state', () => {
    const comps = [component(), component({ key: 'coredns', name: 'CoreDNS' })];
    const snapshot = snapshotOf({ visibleComponents: comps, totalCount: 2, expandedKeys: new Set(['cl-1:traefik', 'cl-1:coredns']) });
    expect(snapshot.attention).toEqual([
      { scopeId: 'platform-components:components:cl-1:traefik', entityRef: platformComponentEntityRef('cl-1', 'traefik'), reason: 'selection' },
      { scopeId: 'platform-components:components:cl-1:coredns', entityRef: platformComponentEntityRef('cl-1', 'coredns'), reason: 'selection' },
    ]);
  });

  it('presents category, status, managedBy, cluster name and an error COUNT, never raw error text', () => {
    const snapshot = snapshotOf({ visibleComponents: [component({ errorCount: 2, errors: ['CrashLoopBackOff: pod x', 'ImagePullBackOff: pod y'] })] });
    const obs = rowScope(snapshot, 'cl-1', 'traefik').observations!;
    expect(obs.find((o) => o.key === 'flui.platform_component.category')?.presentedAs.text).toBe('ingress');
    expect(obs.find((o) => o.key === 'flui.platform_component.status')?.presentedAs.text).toBe('healthy');
    expect(obs.find((o) => o.key === 'flui.platform_component.managed_by')?.presentedAs.text).toBe('flui');
    expect(obs.find((o) => o.key === 'flui.platform_component.cluster_name')?.presentedAs.text).toBe('prod');
    expect(obs.find((o) => o.key === 'flui.platform_component.error_count')?.presentedAs.value).toBe(2);
  });

  it('redacts: raw error text and pod log content never reach the snapshot — only a count', () => {
    const json = JSON.stringify(snapshotOf({ visibleComponents: [component({ errorCount: 1, errors: ['CrashLoopBackOff: secret-token abc123'] })] }));
    expect(json).not.toContain('CrashLoopBackOff');
    expect(json).not.toContain('secret-token');
  });

  it('declares filtered when a filter narrows the visible set', () => {
    const snapshot = snapshotOf({ totalCount: 5, statusFilter: 'healthy' });
    expect(listScope(snapshot).completeness).toEqual({ shown: 1, total: 5, filtered: true });
  });

  it('marks loading/empty from the real signals, never inventing rows', () => {
    const loading = snapshotOf({ visibleComponents: [], totalCount: 0, isLoading: true });
    expect(listScope(loading).state).toEqual({ loading: true, empty: true });
  });

  it('bumps the revision on real change (expanding a component), and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new PlatformComponentsListSurfaceRevision();
    const first = buildPlatformComponentsListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-08-20T09:13:00.000Z' });
    const expanded = input({ expandedKeys: new Set(['cl-1:traefik']) });
    const second = buildPlatformComponentsListSurface(expanded, { revision: tracker.next(presentedContent(expanded)), generatedAt: '2026-08-20T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  // The invalid-revision check needs a real failing case exercised, not just trusted.
  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });
});
