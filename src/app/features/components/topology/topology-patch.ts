import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyStackDto } from '../../../core/api/model/topologyStackDto';
import { TopologyEvent } from '../../service/topology.service';

const SEVERITY: TopologyAppDto.StatusEnum[] = ['error', 'warning', 'stopped', 'running'];

function stacksWith(stacks: TopologyStackDto[], apps: TopologyAppDto[]): TopologyStackDto[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  return stacks.flatMap((stack) => {
    const members = stack.appIds.map((id) => byId.get(id)).filter((a): a is TopologyAppDto => !!a);
    if (!members.length) return [];
    const status = SEVERITY.find((s) => members.some((a) => a.status === s)) ?? 'running';
    return [{ ...stack, appIds: members.map((a) => a.id), status }];
  });
}

function withApps(topology: TopologyResponseDto, apps: TopologyAppDto[]): TopologyResponseDto {
  return { ...topology, apps, stacks: stacksWith(topology.stacks, apps) };
}

function patchApp(
  topology: TopologyResponseDto,
  appId: string | undefined,
  patch: Partial<TopologyAppDto>,
): TopologyResponseDto {
  if (!appId || !topology.apps.some((a) => a.id === appId)) return topology;
  return withApps(
    topology,
    topology.apps.map((a) => (a.id === appId ? { ...a, ...patch } : a)),
  );
}

function withCapacities(
  topology: TopologyResponseDto,
  capacities: NonNullable<TopologyEvent['data']['capacities']>,
): TopologyResponseDto {
  const changes = new Map(capacities.map((c) => [c.serverId, c]));
  if (!changes.size) return topology;
  return {
    ...topology,
    servers: topology.servers.map((s) => {
      const change = changes.get(s.id);
      return change ? { ...s, capacity: change.capacity, podCount: change.podCount } : s;
    }),
  };
}

/** A new or redeployed app, in its stack: an existing one gains it, a new one is made for it. */
function withDeployed(topology: TopologyResponseDto, app: TopologyAppDto): TopologyResponseDto {
  const others = topology.apps.filter((a) => a.id !== app.id);
  const known = topology.stacks.some((s) => s.id === app.stackId);
  const stacks = known
    ? topology.stacks.map((s) =>
        s.id === app.stackId && !s.appIds.includes(app.id) ? { ...s, appIds: [...s.appIds, app.id] } : s,
      )
    : [
        ...topology.stacks,
        {
          id: app.stackId,
          clusterId: app.clusterId,
          name: app.displayName,
          type: 'standalone' as const,
          primaryAppId: app.id,
          appIds: [app.id],
          status: app.status,
        },
      ];
  return withApps({ ...topology, stacks }, [...others, app]);
}

/** The snapshot after one change from the stream; the same object when nothing applies. */
export function applyTopologyEvent(
  topology: TopologyResponseDto,
  { event, data }: TopologyEvent,
): TopologyResponseDto {
  switch (event) {
    case 'app.status_changed':
      return patchApp(topology, data.appId, {
        ...(data.status ? { status: data.status } : {}),
        statusReason: data.statusReason ?? null,
      });
    case 'app.scaled':
      return patchApp(topology, data.appId, {
        ...(data.replicas ? { replicas: data.replicas } : {}),
        ...(data.replicaCount !== undefined ? { replicaCount: data.replicaCount } : {}),
        scalingNote: data.scalingNote ?? null,
      });
    case 'app.deployed':
      return data.app ? withDeployed(topology, data.app) : topology;
    case 'app.removed':
      return data.appId
        ? withApps(topology, topology.apps.filter((a) => a.id !== data.appId))
        : topology;
    case 'server.added':
      return data.server
        ? {
            ...topology,
            servers: [...topology.servers.filter((s) => s.id !== data.server!.id), data.server],
          }
        : topology;
    case 'server.removed':
      return data.serverId
        ? { ...topology, servers: topology.servers.filter((s) => s.id !== data.serverId) }
        : topology;
    case 'server.capacity':
      return withCapacities(topology, data.capacities ?? []);
    case 'links.changed':
      return {
        ...topology,
        links: data.links ?? topology.links,
        clusterLinks: data.clusterLinks ?? topology.clusterLinks,
      };
    default:
      return topology;
  }
}
