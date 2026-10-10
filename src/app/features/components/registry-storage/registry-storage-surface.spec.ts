import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectDeterministicDigest,
  expectValidSurface,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';
import { RegistryStorageStatus, RegistryTraffic } from '../../model/registry-storage.models';
import {
  RegistryStorageSurfaceInput,
  RegistryStorageSurfaceRevision,
  buildRegistryStorageSurface,
  presentedContent,
} from './registry-storage-surface';

const GENERATED_AT = '2026-10-09T10:00:00.000Z';
const GIB = 1024 ** 3;

function status(over: Partial<RegistryStorageStatus> = {}): RegistryStorageStatus {
  return {
    backend: 'filesystem',
    connected: false,
    usage: {
      measuredAt: '2026-10-09T09:30:00.000Z',
      totalBytes: 6 * GIB,
      alertBytes: 16 * GIB,
      capacityBytes: 20 * GIB,
      alerting: false,
      applications: [
        { applicationId: 'app-1', name: 'shop-api', bytes: 3 * GIB },
        { applicationId: 'app-2', name: 'shop-web', bytes: GIB },
      ],
      unreadable: 0,
    },
    ...over,
  };
}

const connected = (): RegistryStorageStatus =>
  status({
    backend: 's3',
    connected: true,
    provider: 'scaleway_object_storage',
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    bucket: 'acme-flui-images',
    connectedAt: '2026-10-01T08:00:00.000Z',
  });

function traffic(over: Partial<RegistryTraffic> = {}): RegistryTraffic {
  return {
    window: '24h',
    requests: { pulls: 120, pushes: 8, deletes: 1 },
    outcomes: { ok: 125, refused: 3, notFound: 1, failed: 0 },
    bytesIn: 2 * GIB,
    bytesOut: 9 * GIB,
    peakBytesPerSecondIn: 1_000_000,
    peakBytesPerSecondOut: 12_500_000,
    readFromBucketBytes: null,
    ...over,
  };
}

function input(over: Partial<RegistryStorageSurfaceInput> = {}): RegistryStorageSurfaceInput {
  return {
    loading: false,
    refused: false,
    hasLoadError: false,
    status: status(),
    measuring: false,
    connecting: null,
    hasConnectError: false,
    connectOpen: true,
    confirmReplace: null,
    replacedBuckets: 0,
    replacedCreatedByFlui: 0,
    removing: false,
    hasRemoveError: false,
    confirmRemove: null,
    traffic: traffic(),
    trafficWindow: '24h',
    trafficLoading: false,
    trafficHidden: false,
    ...over,
  };
}

const snapshotOf = (over: Partial<RegistryStorageSurfaceInput> = {}): SurfaceSnapshot =>
  buildRegistryStorageSurface(input(over), { revision: 1, generatedAt: GENERATED_AT });

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obs = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('image registry storage surface producer', () => {
  it('emits a snapshot that validates against the real schema', () => {
    expectValidSurface(snapshotOf());
    expectValidSurface(snapshotOf({ status: connected(), connectOpen: false }));
  });

  it('renders a byte-identical digest across two calls with the same input', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates while loading, refused, failed, on GitHub images, busy and with the dialog open', () => {
    expectValidSurface(snapshotOf({ status: null, loading: true }));
    expectValidSurface(snapshotOf({ status: null, refused: true }));
    expectValidSurface(snapshotOf({ status: null, hasLoadError: true }));
    expectValidSurface(snapshotOf({ status: status({ usage: undefined }) }));
    expectValidSurface(snapshotOf({ connecting: 'scaleway', hasConnectError: true }));
    expectValidSurface(snapshotOf({ status: connected(), confirmReplace: 'own' }));
  });

  it('invents nothing before the status has loaded', () => {
    const snapshot = snapshotOf({ status: null, loading: true });
    expect(snapshot.scopes.map((s) => s.id)).toEqual(['registry-storage']);
    expect(scope(snapshot, 'registry-storage')!.state).toEqual({ loading: true });
  });

  it('carries a refusal as an observation, never as a view error', () => {
    const snapshot = snapshotOf({ status: null, refused: true });
    expect(obs(snapshot, 'registry-storage', 'flui.registry.refused')!.presentedAs.value).toBe(true);
    expect(scope(snapshot, 'registry-storage')!.state!.error).toBeUndefined();
  });

  it('reports a load failure and a connect failure as coded view errors', () => {
    expect(scope(snapshotOf({ hasLoadError: true }), 'registry-storage')!.state!.errorCode).toBe(
      'flui.registry.load_failed',
    );
    expect(scope(snapshotOf({ hasConnectError: true }), 'registry-storage:bucket')!.state).toEqual({
      error: true,
      errorCode: 'flui.registry.connect_failed',
    });
  });

  it('carries the space in use against the volume, and the alert state', () => {
    const snapshot = snapshotOf({
      status: status({ usage: { ...status().usage!, alerting: true, totalBytes: 17 * GIB } }),
    });
    expect(obs(snapshot, 'registry-storage:usage', 'flui.registry.used_bytes')!.presentedAs.value).toBe(17 * GIB);
    expect(obs(snapshot, 'registry-storage:usage', 'flui.registry.used_percent')!.presentedAs.value).toBe(85);
    expect(obs(snapshot, 'registry-storage:usage', 'flui.registry.alerting')!.presentedAs.value).toBe(true);
    expect(obs(snapshot, 'registry-storage', 'flui.registry.backend')!.presentedAs.text).toBe('volume');
  });

  it('lists the largest applications by their canonical application ref', () => {
    const snapshot = snapshotOf();
    const row = scope(snapshot, 'registry-storage:applications:app-1')!;
    expect(row.label).toBe('shop-api');
    expect(row.entities![0].ref).toBe('flui://application/app-1');
    expect(scope(snapshot, 'registry-storage:applications')!.completeness).toEqual({ shown: 2, total: 2 });
  });

  it('shows only the page when the installation keeps its images on GitHub', () => {
    const snapshot = snapshotOf({ status: status({ usage: undefined }) });
    expect(snapshot.scopes.map((s) => s.id)).toEqual(['registry-storage']);
    expect(obs(snapshot, 'registry-storage', 'flui.registry.own_registry')!.presentedAs.value).toBe(false);
  });

  it('says a connected bucket is not in use while the registry still keeps a volume', () => {
    const snapshot = snapshotOf({ status: { ...connected(), backend: 'filesystem' } });
    expect(obs(snapshot, 'registry-storage:bucket', 'flui.registry.bucket_in_use')!.presentedAs.value).toBe(false);
    expect(obs(snapshot, 'registry-storage:bucket', 'flui.registry.bucket_provider')!.presentedAs.text).toBe('Scaleway');
  });

  it('moves attention onto the replace confirmation while it is open', () => {
    const snapshot = snapshotOf({ status: connected(), confirmReplace: 'scaleway' });
    expect(snapshot.attention).toEqual([{ scopeId: 'registry-storage:confirm-replace', reason: 'overlay' }]);
    expect(snapshotOf({ status: connected() }).attention).toEqual([
      { scopeId: 'registry-storage', reason: 'route' },
    ]);
  });

  it('counts replaced buckets and opens the remove confirmation without naming the bucket', () => {
    const snapshot = snapshotOf({
      status: connected(),
      replacedBuckets: 2,
      replacedCreatedByFlui: 1,
      confirmRemove: { createdByFlui: true },
    });
    expectValidSurface(snapshot);
    expect(obs(snapshot, 'registry-storage:bucket', 'flui.registry.replaced_buckets')!.presentedAs.value).toBe(2);
    expect(
      obs(snapshot, 'registry-storage:bucket', 'flui.registry.replaced_buckets_created_by_flui')!.presentedAs.value,
    ).toBe(1);
    expect(snapshot.attention).toEqual([{ scopeId: 'registry-storage:confirm-remove', reason: 'overlay' }]);
    expect(JSON.stringify(snapshot)).not.toContain('acme-flui-images');
  });

  it('reports a failed removal as a coded view error', () => {
    expect(scope(snapshotOf({ replacedBuckets: 1, hasRemoveError: true }), 'registry-storage:bucket')!.state).toEqual({
      error: true,
      errorCode: 'flui.registry.remove_failed',
    });
  });

  it('redacts: no bucket name, endpoint or key ever reaches the snapshot', () => {
    const json = JSON.stringify(snapshotOf({ status: connected(), confirmReplace: 'own' }));
    expect(json).not.toContain('acme-flui-images');
    expect(json).not.toContain('s3.fr-par.scw.cloud');
    expect(json).not.toMatch(/secret|accessKey|secretKey/i);
  });

  it('bumps the revision on real change, and accepts it against the previous snapshot', () => {
    const tracker = new RegistryStorageSurfaceRevision();
    const before = input();
    const first = buildRegistryStorageSurface(before, {
      revision: tracker.next(presentedContent(before)),
      generatedAt: GENERATED_AT,
    });
    const after = input({ measuring: true });
    const second = buildRegistryStorageSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-10-09T10:00:05.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does not bump the revision when nothing presented changed', () => {
    const tracker = new RegistryStorageSurfaceRevision();
    expect(tracker.next(presentedContent(input()))).toBe(tracker.next(presentedContent(input())));
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf({ measuring: true }), surface: { ...first.surface } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });

  it('carries the traffic figures and the selected window as numbers', () => {
    const snapshot = snapshotOf({ trafficWindow: '7d', traffic: traffic({ readFromBucketBytes: 5 * GIB }) });
    expectValidSurface(snapshot);
    const t = (key: string) => obs(snapshot, 'registry-storage:traffic', key)!.presentedAs;
    expect(t('flui.registry.traffic.window').text).toBe('7d');
    expect(t('flui.registry.traffic.pulls').value).toBe(120);
    expect(t('flui.registry.traffic.pushes').value).toBe(8);
    expect(t('flui.registry.traffic.bytes_out').value).toBe(9 * GIB);
    expect(t('flui.registry.traffic.peak_out').value).toBe(12_500_000);
    expect(t('flui.registry.traffic.refused').value).toBe(3);
    expect(t('flui.registry.traffic.read_from_bucket').value).toBe(5 * GIB);
  });

  it('leaves out the bucket read on a volume, and the whole traffic region when it is not readable', () => {
    expect(obs(snapshotOf(), 'registry-storage:traffic', 'flui.registry.traffic.read_from_bucket')).toBeUndefined();
    expect(scope(snapshotOf({ trafficHidden: true, traffic: null }), 'registry-storage:traffic')).toBeUndefined();
  });

  it('marks the traffic region loading while a window is being read', () => {
    const snapshot = snapshotOf({ traffic: null, trafficLoading: true });
    expectValidSurface(snapshot);
    expect(scope(snapshot, 'registry-storage:traffic')!.state).toEqual({ loading: true });
  });
});
