import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyServerDto } from '../../../core/api/model/topologyServerDto';
import { FAILING_ERROR_PCT } from './topology-graph';

export interface CapacityBlock {
  appId: string | null;
  label: string;
  mi: number;
  tone: string;
}

export interface CapacityColumn {
  server: TopologyServerDto;
  allocatableMi: number;
  blocks: CapacityBlock[];
  freeMi: number;
  ghost: number | null;
}

/**
 * How a cluster's memory is spoken for: one column per server, one block per
 * app by what it requests there, what the system and other pods hold, and the
 * room left. With an app in focus, where its next replica would fit.
 */
export function clusterCapacity(
  t: TopologyResponseDto,
  clusterId: string,
  focusAppId: string | null,
): { columns: CapacityColumn[]; ghostFits: boolean | null; ghostMi: number } {
  const apps = t.apps.filter((a) => a.clusterId === clusterId);
  const focus = focusAppId ? apps.find((a) => a.id === focusAppId) : undefined;
  const columns = t.servers
    .filter((s) => s.clusterId === clusterId && s.capacity)
    .map<CapacityColumn>((server) => {
      const blocks = apps
        .map((a) => ({ a, count: a.replicas.find((r) => r.serverId === server.id)?.count ?? 0 }))
        .filter(({ count }) => count > 0)
        .map<CapacityBlock>(({ a, count }) => ({
          appId: a.id,
          label: a.displayName,
          mi: a.ramRequestMB * count,
          tone: a.status,
        }))
        .sort((x, y) => y.mi - x.mi);
      const requested = server.capacity!.requestedMemMi;
      const apps_ = blocks.reduce((s, b) => s + b.mi, 0);
      if (requested > apps_) {
        blocks.push({ appId: null, label: 'System and other', mi: requested - apps_, tone: 'pending' });
      }
      return {
        server,
        allocatableMi: server.capacity!.allocatableMemMi,
        blocks,
        freeMi: Math.max(0, server.capacity!.allocatableMemMi - Math.max(requested, apps_)),
        ghost: null,
      };
    });

  if (!focus) return { columns, ghostFits: null, ghostMi: 0 };
  const candidates = columns
    .filter((c) => c.server.takesWork && !focus.replicas.some((r) => r.serverId === c.server.id))
    .filter((c) => c.freeMi >= focus.ramRequestMB)
    .sort((a, b) => b.freeMi - a.freeMi);
  if (candidates[0]) candidates[0].ghost = focus.ramRequestMB;
  return { columns, ghostFits: candidates.length > 0, ghostMi: focus.ramRequestMB };
}

export type HopCheck = 'ok' | 'warn' | 'fail';

export interface PathHop {
  step: string;
  title: string;
  lines: string[];
  check: HopCheck;
  checkText: string;
}

export interface RequestPath {
  app: TopologyAppDto;
  hosts: string[];
  hops: PathHop[];
  data: PathHop[];
}

function appCheck(app: TopologyAppDto): { check: HopCheck; checkText: string } {
  if (app.status === 'running') return { check: 'ok', checkText: 'Running' };
  if (app.status === 'warning') return { check: 'warn', checkText: app.statusReason ?? 'Warning' };
  return { check: 'fail', checkText: app.statusReason ?? 'Not running' };
}

/**
 * The way in to an app, hop by hop, from what the snapshot knows: the routes
 * that reach it, the app behind them, where its replicas run, and what it
 * talks to. Nothing here is fetched or guessed beyond that.
 */
export function requestPath(t: TopologyResponseDto, appId: string): RequestPath | null {
  const app = t.apps.find((a) => a.id === appId);
  if (!app) return null;
  const apps = new Map(t.apps.map((a) => [a.id, a]));
  const server = new Map(t.servers.map((s) => [s.id, s]));
  const routes = t.links.filter((l) => l.source === 'gateway-route' && l.to.appId === app.id);
  const rps = routes.reduce((s, l) => s + (l.traffic.rps ?? 0), 0);
  const measured = routes.some((l) => l.traffic.measured);
  const worstError = Math.max(0, ...routes.map((l) => l.traffic.errorPct ?? 0));

  const gateway: PathHop = {
    step: '01 · Gateway',
    title: routes.length === 1 ? 'Route' : `${routes.length} routes`,
    lines: [measured ? `${rpsText(rps)} req/s` : 'Traffic not measured',
      measured ? `${worstError.toFixed(1)}% server errors` : ''].filter(Boolean),
    check: worstError >= FAILING_ERROR_PCT ? 'fail' : 'ok',
    checkText: worstError >= FAILING_ERROR_PCT ? 'Answering with errors' : 'Serving',
  };
  const service: PathHop = {
    step: '02 · App',
    title: app.displayName,
    lines: [`${app.exposure} · ${app.workloadKind}`, `${app.replicaCount} replica${app.replicaCount === 1 ? '' : 's'}`],
    ...appCheck(app),
  };
  const placed = app.replicas.map((r) => server.get(r.serverId));
  const pods: PathHop = {
    step: '03 · Servers',
    title: `${app.replicas.length} server${app.replicas.length === 1 ? '' : 's'}`,
    lines: app.replicas.map((r) => `${server.get(r.serverId)?.nodeName ?? r.serverId} ×${r.count}`),
    check: placed.every((s) => s?.status === 'healthy') ? 'ok' : 'warn',
    checkText: placed.every((s) => s?.status === 'healthy') ? 'All healthy' : 'A server is not healthy',
  };
  const data = t.links
    .filter((l) => l.from.appId === app.id && l.to.appId)
    .map((l) => apps.get(l.to.appId!))
    .filter((a): a is TopologyAppDto => !!a)
    .map<PathHop>((a, i) => ({
      step: i === 0 ? '04 · Talks to' : '',
      title: a.displayName,
      lines: [t.links.find((l) => l.from.appId === app.id && l.to.appId === a.id)?.label ?? '', a.exposure].filter(Boolean),
      ...appCheck(a),
    }));

  return { app, hosts: routes.map((l) => l.routeHost ?? '').filter(Boolean), hops: [gateway, service, pods], data };
}

function rpsText(rps: number): string {
  return rps >= 10 ? String(Math.round(rps)) : rps.toFixed(1);
}
