import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectDeterministicDigest,
  expectValidSurface,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';
import { InstallationNow } from '../../model/installation-now.models';
import {
  InstallationNowSurfaceInput,
  InstallationNowSurfaceRevision,
  buildInstallationNowSurface,
  presentedContent,
} from './installation-now-surface';

const GENERATED_AT = '2026-10-09T10:00:00.000Z';

function now(over: Partial<InstallationNow> = {}): InstallationNow {
  return {
    measuredAt: '2026-10-09T09:59:30.000Z',
    nodes: [
      {
        clusterId: 'c-1',
        clusterName: 'control',
        node: 'control-master',
        cpuPercent: 92,
        memoryPercent: 60,
        mbpsOut: 420,
        mbpsIn: 30,
        monthPaceBytes: 18.4e12,
        includedTb: 20,
      },
      {
        clusterId: 'c-1',
        clusterName: 'control',
        node: 'control-worker-1',
        cpuPercent: null,
        memoryPercent: null,
        mbpsOut: 1,
        mbpsIn: 1,
        monthPaceBytes: 0.1e12,
        includedTb: null,
      },
    ],
    edges: [
      { clusterId: 'c-1', clusterName: 'control', rpsNow: 40, rpsBefore: 4, rateLimited10m: 120, requests10m: 1000, serverErrors10m: 80 },
    ],
    platform: [{ name: 'API', cpuPercent: 40, memoryPercent: 85, restartsLastHour: 1 }],
    registry: {
      requests: { pulls: 30, pushes: 2, deletes: 0 },
      outcomes: { ok: 31, refused: 1, notFound: 0, failed: 0 },
      bytesIn: 100,
      bytesOut: 200 * 1024 * 1024,
      peakBytesPerSecondIn: 0,
      peakBytesPerSecondOut: 5_000_000,
      readFromBucketBytes: null,
    },
    sandbox: { live: 18, warm: 2, ceiling: 24, waiting: 3, fullRefusals: 1 },
    alerts: { firing: 2, critical: 1, names: ['FluiTrafficSurge', 'FluiNodeCpuHigh'] },
    thresholds: {
      nodeMbps: 400,
      monthlyTrafficPercent: 80,
      spikeFactor: 3,
      spikeMinRps: 5,
      rateLimitedPer10m: 100,
      edgeErrorPercent: 5,
    },
    ...over,
  };
}

function input(over: Partial<InstallationNowSurfaceInput> = {}): InstallationNowSurfaceInput {
  return { loading: false, refused: false, hasError: false, paused: false, now: now(), ...over };
}

const snapshotOf = (over: Partial<InstallationNowSurfaceInput> = {}): SurfaceSnapshot =>
  buildInstallationNowSurface(input(over), { revision: 1, generatedAt: GENERATED_AT });

const scope = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === id);
const obs = (s: SurfaceSnapshot, scopeId: string, key: string) =>
  scope(s, scopeId)?.observations?.find((o) => o.key === key);

describe('installation now surface producer', () => {
  it('emits a snapshot that validates against the real schema', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('validates while loading, refused, failed, paused and without the optional blocks', () => {
    expectValidSurface(snapshotOf({ now: null, loading: true }));
    expectValidSurface(snapshotOf({ now: null, refused: true }));
    expectValidSurface(snapshotOf({ hasError: true, paused: true }));
    expectValidSurface(snapshotOf({ now: now({ sandbox: null, registry: null, edges: [], nodes: [], platform: [] }) }));
  });

  it('invents nothing before the first reading', () => {
    const snapshot = snapshotOf({ now: null, loading: true });
    expect(snapshot.scopes.map((s) => s.id)).toEqual(['installation-now']);
    expect(scope(snapshot, 'installation-now')!.state).toEqual({ loading: true });
  });

  it('carries a refusal as an observation, not a view error', () => {
    const snapshot = snapshotOf({ now: null, refused: true });
    expect(obs(snapshot, 'installation-now', 'flui.now.refused')!.presentedAs.value).toBe(true);
    expect(scope(snapshot, 'installation-now')!.state!.error).toBeUndefined();
  });

  it('carries the alerts and the demo figures', () => {
    const snapshot = snapshotOf();
    expect(obs(snapshot, 'installation-now', 'flui.now.alerts_firing')!.presentedAs.value).toBe(2);
    expect(obs(snapshot, 'installation-now', 'flui.now.alerts_critical')!.presentedAs.value).toBe(1);
    expect(obs(snapshot, 'installation-now:demo', 'flui.now.demo.live')!.presentedAs.value).toBe(18);
    expect(obs(snapshot, 'installation-now:demo', 'flui.now.demo.waiting')!.presentedAs.value).toBe(3);
  });

  it('marks surge, rate limit and server errors at the door against the thresholds', () => {
    const snapshot = snapshotOf();
    const row = 'installation-now:requests:c-1';
    expect(scope(snapshot, row)!.entities![0].ref).toBe('flui://cluster/c-1');
    expect(obs(snapshot, row, 'flui.now.edge.surge')!.presentedAs.value).toBe(true);
    expect(obs(snapshot, row, 'flui.now.edge.rate_limit_alert')!.presentedAs.value).toBe(true);
    expect(obs(snapshot, row, 'flui.now.edge.server_error_percent')!.presentedAs.value).toBe(8);
    expect(obs(snapshot, row, 'flui.now.edge.error_alert')!.presentedAs.value).toBe(true);
  });

  it('carries node figures, levels and the month at its pace', () => {
    const snapshot = snapshotOf();
    const master = 'installation-now:nodes:c-1:control-master';
    expect(obs(snapshot, master, 'flui.now.node.cpu_level')!.presentedAs.text).toBe('bad');
    expect(obs(snapshot, master, 'flui.now.node.link_alert')!.presentedAs.value).toBe(true);
    expect(obs(snapshot, master, 'flui.now.node.month_share_percent')!.presentedAs.value).toBe(92);
    expect(obs(snapshot, master, 'flui.now.node.month_alert')!.presentedAs.value).toBe(true);
    const worker = 'installation-now:nodes:c-1:control-worker-1';
    expect(obs(snapshot, worker, 'flui.now.node.cpu_percent')).toBeUndefined();
    expect(obs(snapshot, worker, 'flui.now.node.not_metered')!.presentedAs.value).toBe(true);
  });

  it('carries platform components and the registry hour', () => {
    const snapshot = snapshotOf();
    expect(obs(snapshot, 'installation-now:platform:API', 'flui.now.platform.memory_percent')!.presentedAs.value).toBe(85);
    expect(obs(snapshot, 'installation-now:registry', 'flui.now.registry.pulls')!.presentedAs.value).toBe(30);
    expect(scope(snapshotOf({ now: now({ registry: null, sandbox: null }) }), 'installation-now:registry')).toBeUndefined();
  });

  it('bumps the revision on real change and accepts it against the previous snapshot', () => {
    const tracker = new InstallationNowSurfaceRevision();
    const before = input();
    const first = buildInstallationNowSurface(before, { revision: tracker.next(presentedContent(before)), generatedAt: GENERATED_AT });
    const after = input({ paused: true });
    const second = buildInstallationNowSurface(after, {
      revision: tracker.next(presentedContent(after)),
      generatedAt: '2026-10-09T10:00:30.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('does not bump the revision when nothing presented changed', () => {
    const tracker = new InstallationNowSurfaceRevision();
    expect(tracker.next(presentedContent(input()))).toBe(tracker.next(presentedContent(input())));
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf({ paused: true }), surface: { ...first.surface } };
    expect(validateSurfaceSemantics(stale, { previousSnapshot: first })).toEqual([
      jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' }),
    ]);
  });
});
