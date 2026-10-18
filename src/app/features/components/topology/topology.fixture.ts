import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';

/** A small fleet for specs: two clusters, three servers, a composed stack and a standalone app. */
export function topologyFixture(): TopologyResponseDto {
  const capacity = (usedMemPct: number) => ({
    allocatableCpuM: 7800,
    allocatableMemMi: 15_800,
    requestedCpuM: 3000,
    requestedMemMi: 9000,
    usedCpuPct: 30,
    usedMemPct,
  });
  return {
    version: '2',
    generatedAt: '2026-10-17T15:00:00.000Z',
    clusters: [
      {
        id: 'c-eu', name: 'prod-eu', displayName: 'prod-eu', provider: 'hetzner', region: 'fsn1',
        type: 'workload', status: 'degraded', k3sVersion: 'v1.31.4+k3s1', overlay: 'tunnel',
        counts: { apps: 3, stacks: 2, servers: 2, errors: 1, warnings: 0 },
        inbound: [
          { protocol: 'tcp', port: '443', description: 'HTTPS', fromAnywhere: true, sourceCount: 2 },
          { protocol: 'tcp', port: '22', description: 'SSH', fromAnywhere: false, sourceCount: 1 },
        ],
      },
      {
        id: 'c-asia', name: 'edge-asia', displayName: 'edge-asia', provider: 'contabo', region: 'sin',
        type: 'workload', status: 'healthy', k3sVersion: 'v1.31.4+k3s1', overlay: 'public-address',
        counts: { apps: 1, stacks: 1, servers: 1, errors: 0, warnings: 0 },
        inbound: null,
      },
    ],
    servers: [
      {
        id: 's-1', clusterId: 'c-eu', nodeName: 'eu-worker-1', provider: 'hetzner', providerResourceId: '481',
        serverType: 'cpx41', architecture: 'x86', role: 'worker', takesWork: true, status: 'healthy',
        capacity: capacity(92), podCount: 3, privateNetwork: true, fluiNetwork: 'active',
      },
      {
        id: 's-2', clusterId: 'c-eu', nodeName: 'eu-arm-1', provider: 'hetzner', providerResourceId: '482',
        serverType: 'cax31', architecture: 'arm', role: 'worker', takesWork: true, status: 'healthy',
        capacity: capacity(55), podCount: 1, privateNetwork: true, fluiNetwork: 'pending',
      },
      {
        id: 'node:c-asia:abc', clusterId: 'c-asia', nodeName: 'asia-1', provider: 'contabo', providerResourceId: null,
        serverType: null, architecture: null, role: 'control-plane', takesWork: true, status: 'healthy',
        capacity: null, podCount: 1, privateNetwork: false, fluiNetwork: 'none',
      },
    ],
    stacks: [
      { id: 'i-shop', clusterId: 'c-eu', name: 'Shop', type: 'composed', primaryAppId: 'a-web', appIds: ['a-web', 'a-db'], status: 'error' },
      { id: 'app:a-tools', clusterId: 'c-eu', name: 'Tools', type: 'standalone', primaryAppId: 'a-tools', appIds: ['a-tools'], status: 'running' },
      { id: 'app:a-web-asia', clusterId: 'c-asia', name: 'Web', type: 'standalone', primaryAppId: 'a-web-asia', appIds: ['a-web-asia'], status: 'running' },
    ],
    apps: [
      app('a-web', 'c-eu', 'i-shop', 'Web', 'g-web', 'error', 'CrashLoopBackOff', [{ serverId: 's-1', count: 2 }, { serverId: 's-2', count: 1 }]),
      app('a-db', 'c-eu', 'i-shop', 'Database', 'app:a-db', 'running', null, [{ serverId: 's-1', count: 1 }]),
      app('a-tools', 'c-eu', 'app:a-tools', 'Tools', 'app:a-tools', 'running', null, [{ serverId: 's-1', count: 1 }]),
      app('a-web-asia', 'c-asia', 'app:a-web-asia', 'Web', 'g-web', 'running', null, [{ serverId: 'node:c-asia:abc', count: 1 }]),
    ],
    links: [
      {
        id: 'l-in', from: { kind: 'internet' }, to: { kind: 'app', appId: 'a-web' }, source: 'gateway-route',
        label: 'HTTPS', crossCluster: false, viaTunnel: false, routeHost: 'shop.example.org',
        routePath: '/api', targetPort: 3000,
        traffic: { measured: true, rps: 120, errorPct: 40 },
      },
      {
        id: 'l-db', from: { kind: 'app', appId: 'a-web' }, to: { kind: 'app', appId: 'a-db' }, source: 'attached-service',
        label: ':5432', crossCluster: false, viaTunnel: false, routeHost: null,
        routePath: null, targetPort: null,
        traffic: { measured: false, rps: null, errorPct: null },
      },
    ],
    clusterLinks: [],
    projects: [{ id: 'p-shop', name: 'Shop' }],
    stats: {
      totalClusters: 2, totalServers: 3, totalStacks: 3, totalApps: 4, totalReplicas: 6,
      totalRamMB: 1536, errorCount: 1, warningCount: 0, droppedApps: 0,
    },
  };
}

type FixtureApp = [
  id: string, clusterId: string, stackId: string, displayName: string, groupKey: string,
  status: 'running' | 'error', statusReason: string | null,
  replicas: { serverId: string; count: number }[],
];

function app(...row: FixtureApp) {
  const [id, clusterId, stackId, displayName, groupKey, status, statusReason, replicas] = row;
  return {
    id, clusterId, stackId, groupKey, name: displayName.toLowerCase(), slug: displayName.toLowerCase(), displayName,
    category: 'web' as const, kind: 'user' as const, workloadKind: 'deployment' as const, exposure: 'public' as const,
    namespace: 'acme-shop', status, statusReason, ramRequestMB: 256, ramLimitMB: 512, cpuRequestM: 100, cpuLimitM: 200,
    primaryServerId: replicas[0].serverId, replicas, replicaCount: replicas.reduce((s, r) => s + r.count, 0),
    scalingMode: 'manual' as const, scalingNote: null,
    // The shop's apps belong to its project; the tools and the Asia web are in none.
    projectId: stackId === 'i-shop' ? 'p-shop' : null,
  };
}
