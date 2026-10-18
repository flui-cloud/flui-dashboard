import { Params } from '@angular/router';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus, TopologyViewState } from './topology-state';

export interface TopologyDestination {
  label: string;
  commands: string[];
  queryParams?: Params;
}

export interface TopologyDrillLink {
  label: string;
  state: Partial<TopologyViewState>;
}

export interface TopologyDestinations {
  open: TopologyDestination | null;
  quick: TopologyDestination[];
  /** Deeper views inside Topology itself, open to everyone, guests included. */
  drills: TopologyDrillLink[];
}

const NONE: TopologyDestinations = { open: null, quick: [], drills: [] };

const capacityOf = (clusterId: string, focus: TopologyFocus): TopologyDrillLink => ({
  label: 'Capacity',
  state: { drill: 'capacity', cluster: clusterId, focus },
});

const pathOf = (focus: TopologyFocus): TopologyDrillLink => ({
  label: 'Request path',
  state: { drill: 'path', focus },
});

const serviceMapOf = (appId: string, clusterId: string): TopologyDrillLink => ({
  label: 'Service map',
  state: { view: 'services', level: 'app', app: appId, cluster: clusterId, focus: { type: 'app', id: appId }, drill: null },
});

const serversOf = (appId: string): TopologyDrillLink => ({
  label: 'On servers',
  state: { view: 'infrastructure', focus: { type: 'app', id: appId }, drill: null },
});

const appTab = (id: string, tab: string, label: string): TopologyDestination => ({
  label,
  commands: ['/apps/applications', id, tab],
});

const clusterTab = (id: string, tab: string, label: string): TopologyDestination => ({
  label,
  commands: ['/cluster', id, tab],
});

/**
 * Where each element of the map leads. Topology only navigates; every change
 * happens on these pages, under their own permissions.
 *
 * A guest is looking at example data: only the pages the demo fills with the
 * same example entities are offered, so an Open never lands on a refusal. The
 * views inside Topology itself are open to everyone.
 */
export function destinationsFor(
  focus: TopologyFocus | null,
  topology: TopologyResponseDto | null,
  guest: boolean,
): TopologyDestinations {
  if (!focus || !topology) return NONE;
  switch (focus.type) {
    case 'cluster':
      return clusterDestinations(topology, focus, guest);
    case 'server':
      return serverDestinations(topology, focus, guest);
    case 'stack':
      return stackDestinations(topology, focus, guest);
    case 'app':
      return appDestinations(topology, focus, guest);
    case 'link':
      return linkDestinations(topology, focus, guest);
  }
}

/** A guest keeps the views inside Topology and nothing that leaves it. */
const forGuest = (drills: TopologyDrillLink[]): TopologyDestinations => ({ open: null, quick: [], drills });

function clusterDestinations(t: TopologyResponseDto, focus: TopologyFocus, guest: boolean): TopologyDestinations {
  const cluster = t.clusters.find((c) => c.id === focus.id);
  if (!cluster) return NONE;
  const drills = [capacityOf(cluster.id, focus)];
  if (guest) return forGuest(drills);
  const quick = [
    clusterTab(cluster.id, 'nodes', 'Nodes'),
    clusterTab(cluster.id, 'network', 'Network'),
    clusterTab(cluster.id, 'monitoring', 'Monitoring'),
  ];
  if (cluster.overlay === 'public-address') {
    quick.push({ label: 'Flui network', commands: ['/infrastructure/vnet'] });
  }
  return { open: clusterTab(cluster.id, 'overview', 'Open cluster'), quick, drills };
}

function serverDestinations(t: TopologyResponseDto, focus: TopologyFocus, guest: boolean): TopologyDestinations {
  const server = t.servers.find((s) => s.id === focus.id);
  if (!server) return NONE;
  const open = server.providerResourceId
    ? { label: 'Open server', commands: ['/infrastructure/compute', server.provider, server.providerResourceId] }
    : null;
  const quick = guest ? [] : [clusterTab(server.clusterId, 'scaling', 'Scaling')];
  return { open, quick, drills: [capacityOf(server.clusterId, focus)] };
}

function stackDestinations(t: TopologyResponseDto, focus: TopologyFocus, guest: boolean): TopologyDestinations {
  const stack = t.stacks.find((s) => s.id === focus.id);
  if (!stack || guest) return NONE;
  const open =
    stack.type === 'composed'
      ? { label: 'Open stack', commands: ['/apps/recap', stack.primaryAppId], queryParams: { from: 'applications' } }
      : appTab(stack.primaryAppId, 'overview', 'Open app');
  return { open, quick: [], drills: [] };
}

function appDestinations(t: TopologyResponseDto, focus: TopologyFocus, guest: boolean): TopologyDestinations {
  const app = t.apps.find((a) => a.id === focus.id);
  if (!app) return NONE;
  const routed = t.links.some((l) => l.source === 'gateway-route' && l.to.appId === app.id);
  const drills = [
    serviceMapOf(app.id, app.clusterId),
    serversOf(app.id),
    ...(routed ? [pathOf(focus)] : []),
    capacityOf(app.clusterId, focus),
  ];
  if (guest) return forGuest(drills);
  return {
    open: appTab(app.id, 'overview', 'Open app'),
    quick: [
      appTab(app.id, 'logs', 'Logs'),
      appTab(app.id, 'resources', 'Resources'),
      appTab(app.id, 'configuration', 'Configuration'),
      appTab(app.id, 'gateway', 'Gateway'),
    ],
    drills,
  };
}

function linkDestinations(t: TopologyResponseDto, focus: TopologyFocus, guest: boolean): TopologyDestinations {
  const link = t.links.find((l) => l.id === focus.id);
  if (!link?.to.appId || link.source !== 'gateway-route') return NONE;
  const drills = [pathOf({ type: 'app', id: link.to.appId })];
  if (guest) return forGuest(drills);
  return { open: appTab(link.to.appId, 'gateway', 'Open route'), quick: [], drills };
}
