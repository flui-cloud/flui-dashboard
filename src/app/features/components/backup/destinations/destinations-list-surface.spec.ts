import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  DestinationsListSurfaceInput,
  DestinationsListSurfaceRevision,
  buildDestinationsListSurface,
  destinationEntityRef,
  presentedContent,
} from './destinations-list-surface';
import type { BackupDestination } from '../../../model/backup.models';

const DEST: BackupDestination = {
  id: 'dest-1',
  userId: 'u1',
  name: 'primary-eu',
  provider: 'scaleway_object_storage' as BackupDestination['provider'],
  endpoint: 'https://s3.fr-par.scw.cloud',
  region: 'fr-par',
  bucket: 'flui-backups',
  encryptionMode: 'sse' as BackupDestination['encryptionMode'],
  useSse: true,
  forcePathStyle: false,
  usableForEtcdL1: true,
  healthStatus: 'healthy',
  lastHealthCheckAt: '2026-09-01T00:00:00.000Z',
  lastHealthError: 'dial tcp 10.0.0.1:443: connect: leaked-secret sk_live_ABC',
  usageBytes: '1073741824',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function input(over: Partial<DestinationsListSurfaceInput> = {}): DestinationsListSurfaceInput {
  return { destinations: [DEST], loading: false, hasLoadError: false, ...over };
}

function snapshotOf(over: Partial<DestinationsListSurfaceInput> = {}): SurfaceSnapshot {
  return buildDestinationsListSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const listScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'list')!;
const rowScope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `backup-destinations:list:${id}`)!;

describe('destinations list surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new DestinationsListSurfaceRevision();
    const first = buildDestinationsListSurface(input(), { revision: tracker.next(presentedContent(input())), generatedAt: '2026-09-02T09:13:00.000Z' });
    const changed = input({ destinations: [{ ...DEST, healthStatus: 'degraded' }] });
    const second = buildDestinationsListSurface(changed, { revision: tracker.next(presentedContent(changed)), generatedAt: '2026-09-02T09:14:00.000Z' });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is a list page with no selection: attention names only the page, every row is related', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'backup-destinations', reason: 'route' }]);
    const row = rowScope(snapshot, 'dest-1');
    expect(row.entities).toEqual([{ ref: destinationEntityRef('dest-1'), label: 'primary-eu', role: 'related' }]);
  });

  it('declares completeness, and truncates past the row cap', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...DEST, id: `d${i}` }));
    const snapshot = snapshotOf({ destinations: many });
    expect(listScope(snapshot).completeness).toEqual({ shown: 50, total: 60, truncated: true });
  });

  it('presents provider, region, bucket, health and usage as shown in the row', () => {
    const row = rowScope(snapshotOf(), 'dest-1');
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.backup.destination.provider')?.presentedAs.text).toBe('Scaleway Object Storage');
    expect(obs('flui.backup.destination.region')?.presentedAs.text).toBe('fr-par');
    expect(obs('flui.backup.destination.health')?.presentedAs.text).toBe('healthy');
    expect(obs('flui.backup.destination.usage')?.presentedAs.text).toBe('1.0 GB');
  });

  it('produces an empty (not missing) list scope when there are no destinations yet', () => {
    const snapshot = snapshotOf({ destinations: [] });
    expect(listScope(snapshot).state).toEqual({ loading: false, empty: true });
    expect(listScope(snapshot).completeness).toEqual({ shown: 0, total: 0 });
  });

  it('redacts: the raw health-check error text never reaches the row', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('sk_live_ABC');
    expect(json).not.toContain('dial tcp');
  });
});
