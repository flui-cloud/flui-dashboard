import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../../testing/surface-test-utils';

import {
  DestinationDetailSurfaceInput,
  DestinationDetailSurfaceRevision,
  buildDestinationDetailSurface,
  destinationEntityRef,
  presentedContent,
} from './destination-detail-surface';
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
  usageBytes: '1073741824',
  costPerGbMonthCents: 200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function input(over: Partial<DestinationDetailSurfaceInput> = {}): DestinationDetailSurfaceInput {
  return { destination: DEST, ...over };
}

function snapshotOf(over: Partial<DestinationDetailSurfaceInput> = {}): SurfaceSnapshot {
  const s = buildDestinationDetailSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
  if (!s) throw new Error('the producer described nothing');
  return s;
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.kind === 'page')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('destination detail surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new DestinationDetailSurfaceRevision();
    const first = buildDestinationDetailSurface(input(), { revision: tracker.next(presentedContent(input())!), generatedAt: '2026-09-02T09:13:00.000Z' })!;
    const changed = input({ destination: { ...DEST, healthStatus: 'degraded' } });
    const second = buildDestinationDetailSurface(changed, { revision: tracker.next(presentedContent(changed)!), generatedAt: '2026-09-02T09:14:00.000Z' })!;
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('claims the page and the destination itself, with reason route and role primary', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([
      { scopeId: `backup-destination-detail:${DEST.id}`, entityRef: destinationEntityRef(DEST.id), reason: 'route' },
    ]);
    expect(pageScope(snapshot).entities).toEqual([{ ref: destinationEntityRef(DEST.id), label: DEST.name, role: 'primary' }]);
  });

  it('presents health, endpoint, region/bucket, encryption, usage and estimated cost', () => {
    const snapshot = snapshotOf();
    expect(observation(snapshot, 'flui.backup.destination.health')?.presentedAs.text).toBe('healthy');
    expect(observation(snapshot, 'flui.backup.destination.usage')?.presentedAs.text).toBe('1.0 GB');
    expect(observation(snapshot, 'flui.backup.destination.estimated_cost_eur')?.presentedAs.text).toBe('2.00');
  });

  it('produces no snapshot at all when there is no destination loaded — no invented selection', () => {
    expect(buildDestinationDetailSurface(input({ destination: null }), { revision: 1, generatedAt: '2026-09-02T09:13:00.000Z' })).toBeNull();
  });

  it('redacts: the raw health-check error text never reaches the snapshot, only a boolean flag', () => {
    const withError: BackupDestination = { ...DEST, lastHealthError: 'dial tcp: refused, key sk_live_XYZ' };
    const json = JSON.stringify(snapshotOf({ destination: withError }));
    expect(json).not.toContain('sk_live_XYZ');
    expect(json).not.toContain('dial tcp');
    expect(observation(snapshotOf({ destination: withError }), 'flui.backup.destination.has_health_error')?.presentedAs.value).toBe(true);
  });
});
