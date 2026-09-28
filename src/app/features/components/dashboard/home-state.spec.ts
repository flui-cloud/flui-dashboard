import { ClusterInfo, ClusterStatus, ClusterType } from '../../model/cluster.models';
import { FleetClusterMetrics, FleetMetrics, FleetPoint } from '../../service/fleet.service';
import { clusterRow, fleetTiles, isFreshInstall, providerChip, relativeTime } from './home-state';

const NOW = Date.parse('2026-09-27T12:00:00.000Z');

const point = (minutesAgo: number, over: Partial<FleetPoint> = {}): FleetPoint => ({
  timestamp: new Date(NOW - minutesAgo * 60_000).toISOString(),
  cpuPercent: 10,
  memoryPercent: 40,
  diskPercent: 12,
  networkInBytesPerSecond: 1024,
  networkOutBytesPerSecond: 2048,
  nodes: 2,
  ...over,
});

const metrics = (over: Partial<FleetMetrics['fleet']> = {}): FleetMetrics => {
  const series = [point(3), point(2), point(1, { cpuPercent: 12 }), point(0, { cpuPercent: 20 })];
  return {
    window: '3h',
    step: '1m',
    rangeStart: '',
    rangeEnd: '',
    queriedAt: '',
    fleet: {
      clustersTotal: 2,
      clustersReporting: 2,
      nodesReporting: 3,
      current: series.at(-1)!,
      series,
      ...over,
    },
    clusters: [],
  };
};

describe('home state', () => {
  describe('isFreshInstall', () => {
    const control = { clusterType: ClusterType.CONTROL };
    const workload = { clusterType: ClusterType.WORKLOAD };

    it('is fresh with only the control cluster and no app of the user', () => {
      expect(isFreshInstall({ loading: false, userApps: 0, clusters: [control] })).toBe(true);
    });

    it('treats the legacy control type as control', () => {
      expect(
        isFreshInstall({ loading: false, userApps: 0, clusters: [{ clusterType: ClusterType.OBSERVABILITY }] }),
      ).toBe(true);
    });

    it('is not fresh once a workload cluster exists, even while it is created', () => {
      expect(isFreshInstall({ loading: false, userApps: 0, clusters: [control, workload] })).toBe(false);
    });

    it('is not fresh once the user has an app', () => {
      expect(isFreshInstall({ loading: false, userApps: 1, clusters: [control] })).toBe(false);
    });

    it('decides nothing while loading', () => {
      expect(isFreshInstall({ loading: true, userApps: 0, clusters: [] })).toBe(false);
    });
  });

  describe('fleetTiles', () => {
    it('shows the fleet reading with its change against the window', () => {
      const [cpu, memory, disk, network] = fleetTiles(metrics(), false);
      expect(cpu.value).toBe('20.0');
      expect(cpu.unit).toBe('%');
      expect(cpu.delta).toBe('+9.0%');
      expect(cpu.footnote).toBe('2 clusters reporting');
      expect(memory.footnote).toBe('across 3 nodes');
      expect(disk.label).toBe('Avg disk');
      expect(network.value).toBe('3 KB/s');
      expect(network.footnote).toBe('↓ 1 KB/s · ↑ 2 KB/s');
    });

    it('shows a dash, not a zero, when no cluster reports now', () => {
      const tiles = fleetTiles(metrics({ current: null, clustersReporting: 0, nodesReporting: 0 }), false);
      for (const tile of tiles) {
        expect(tile.value).toBe('—');
        expect(tile.delta).toBeUndefined();
        expect(tile.footnote).toBe('no cluster reporting');
      }
    });

    it('says the reading is the control cluster alone on a fresh install', () => {
      const [cpu, memory] = fleetTiles(metrics(), true);
      expect(cpu.footnote).toBe('control cluster only');
      expect(memory.footnote).toBe('control cluster only');
    });
  });

  describe('clusterRow', () => {
    const cluster = (over: Partial<ClusterInfo> = {}): ClusterInfo => ({
      id: 'c-1',
      name: 'control-cluster',
      status: ClusterStatus.ACTIVE,
      clusterType: ClusterType.CONTROL,
      provider: 'hetzner' as ClusterInfo['provider'],
      nodeCount: 1,
      ...over,
    });
    const row = (over: Partial<FleetClusterMetrics> = {}): FleetClusterMetrics => ({
      clusterId: 'c-1',
      name: 'control-cluster',
      provider: 'hetzner',
      clusterType: 'control',
      status: 'active',
      metrics: 'reporting',
      nodesReporting: 1,
      lastSampleAt: point(0).timestamp,
      current: point(0, { cpuPercent: 13.5, memoryPercent: 52.1 }),
      series: [point(1), point(0, { cpuPercent: 13.5, memoryPercent: 52.1 })],
      ...over,
    });

    it('draws a reporting cluster with its current readings', () => {
      const r = clusterRow(cluster(), row(), { user: 0, system: 10 }, 'Hetzner', NOW);
      expect(r.chip).toBe('HE');
      expect(r.meta).toBe('Hetzner · control · 1 node');
      expect(r.status).toEqual({ label: 'Active', tone: 'ok' });
      expect(r.live).toBe(true);
      expect(r.cpuNow).toBe('13.5%');
      expect(r.memoryNow).toBe('52.1%');
      expect(r.cpu).toEqual([10, 13.5]);
      expect(r.apps).toBe('10 system');
    });

    it('says when a cluster stopped reporting', () => {
      const r = clusterRow(
        cluster({ clusterType: ClusterType.WORKLOAD }),
        row({ metrics: 'stale', current: null, lastSampleAt: point(120).timestamp }),
        { user: 2, system: 3 },
        'Scaleway',
        NOW,
      );
      expect(r.live).toBe(false);
      expect(r.note).toBe('No metrics since 2h ago');
      expect(r.meta).toBe('Scaleway · 1 node');
      expect(r.apps).toBe('2 apps');
    });

    it('describes a cluster being created instead of its metrics', () => {
      const r = clusterRow(cluster({ status: ClusterStatus.CREATING, nodeCount: 0 }), undefined, undefined, 'OVH', NOW);
      expect(r.status.label).toBe('Creating');
      expect(r.note).toBe('Provisioning cluster');
      expect(r.inProgress).toBe(true);
      expect(r.apps).toBe('—');
      expect(r.meta).toBe('OVH · control');
    });

    it('stays quiet about metrics it never read', () => {
      const r = clusterRow(cluster(), undefined, undefined, 'Hetzner', NOW);
      expect(r.note).toBe('');
      expect(r.cpuNow).toBe('—');
    });
  });

  it('writes provider chips and relative times', () => {
    expect(providerChip('Scaleway')).toBe('SC');
    expect(providerChip('Google Cloud')).toBe('GC');
    expect(relativeTime(new Date(NOW - 30_000), NOW)).toBe('just now');
    expect(relativeTime(new Date(NOW - 3 * 86_400_000), NOW)).toBe('3d ago');
    expect(relativeTime(null, NOW)).toBe('—');
  });
});
