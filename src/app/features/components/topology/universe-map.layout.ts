import { TopologyClusterDto } from '../../../core/api/model/topologyClusterDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';

import {
  AppNode,
  CATEGORY_COLORS,
  GALAXY_COLORS,
  GalaxyNode,
  MoonNode,
  ServerNode,
} from './universe-map.types';

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.trunc(h * 31 + (id.codePointAt(i) ?? 0));
  }
  return Math.abs(h);
}

function galaxyPosition(index: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0, y: 0 };
  if (total === 2) return { x: index === 0 ? -700 : 700, y: 0 };
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const cx = (index % cols) - (cols - 1) / 2;
  const cy = Math.floor(index / cols) - (rows - 1) / 2;
  return { x: cx * 1500, y: cy * 1100 };
}

function galaxyRadius(cluster: TopologyClusterDto): number {
  const apps = cluster.apps.length;
  return Math.max(260, Math.min(640, 230 + apps * 12));
}

/**
 * Combined resource score used to size a planet. Both RAM and CPU contribute,
 * with sqrt to prevent the largest workloads from dominating the visual.
 */
function userRingCap(userCount: number): number {
  if (userCount <= 4) return 4;
  if (userCount <= 9) return 5;
  if (userCount <= 16) return 6;
  return 7;
}

function userRingSpacing(userCount: number): number {
  if (userCount <= 4) return 56;
  if (userCount <= 9) return 48;
  return 44;
}

function buildAppMoons(app: AppNode): void {
  app.moons = [];
  let moonIdx = 0;
  for (const rs of app.replicaServers) {
    const moonsToAdd = rs.server.id === app.primaryServer.id ? rs.count - 1 : rs.count;
    for (let k = 0; k < moonsToAdd; k++) {
      const moon: MoonNode = {
        app,
        hostServer: rs.server,
        moonIdx,
        moA: moonIdx * 1.7,
        moS: 0.003 + moonIdx * 0.0008,
        moR: app.r * 1.9 + moonIdx * 4,
        r: Math.max(2.5, app.r * 0.45),
        x: 0,
        y: 0,
      };
      app.moons.push(moon);
      moonIdx++;
    }
  }
}

interface ServerLayoutCtx {
  serverIndex: number;
  sysBeltStart: number;
  sysRingStep: number;
  sysRingCap: number;
  sysCount: number;
  userBeltStart: number;
  userCount: number;
}

function applySystemAppOrbit(app: AppNode, j: number, ctx: ServerLayoutCtx): void {
  const lvl = Math.floor(j / ctx.sysRingCap);
  const inLvl = j % ctx.sysRingCap;
  const inLvlN = Math.max(1, Math.min(ctx.sysRingCap, ctx.sysCount - lvl * ctx.sysRingCap));
  app.oR = ctx.sysBeltStart + lvl * ctx.sysRingStep + app.r * 0.4;
  app.oA = (inLvl / inLvlN) * Math.PI * 2 + lvl * 0.3 + ctx.serverIndex * 0.5;
  app.oS = 0.001 / Math.sqrt(1 + lvl * 0.5);
  app.ringLevel = -1;
}

function applyUserAppOrbit(app: AppNode, j: number, ctx: ServerLayoutCtx): void {
  const userIdx = j - ctx.sysCount;
  const ringCap = userRingCap(ctx.userCount);
  const lvl = Math.floor(userIdx / ringCap);
  const inLvl = userIdx % ringCap;
  const inLvlN = Math.max(1, Math.min(ringCap, ctx.userCount - lvl * ringCap));
  const ringSpacing = userRingSpacing(ctx.userCount);
  app.oR = ctx.userBeltStart + lvl * ringSpacing + app.r * 0.5;
  app.oA = (inLvl / inLvlN) * Math.PI * 2 + lvl * 0.5 + ctx.serverIndex * 0.7;
  app.oS = 0.0007 / Math.sqrt(1 + lvl * 0.7);
  app.ringLevel = lvl;
}

function layoutServerApps(server: ServerNode, serverIndex: number, allApps: AppNode[]): void {
  const systemApps = allApps
    .filter((a) => a.kind === 'system')
    .sort((a, b) => b.ramRequestMB - a.ramRequestMB);
  const userApps = allApps
    .filter((a) => a.kind === 'user')
    .sort((a, b) => b.ramRequestMB - a.ramRequestMB);
  const apps = [...systemApps, ...userApps];

  const sysCount = systemApps.length;
  const userCount = userApps.length;
  const sysBeltStart = server.r + 14;
  const sysRingStep = 14;
  const sysRingCap = 8;
  const sysBeltMax =
    sysCount > 0
      ? sysBeltStart + Math.floor((sysCount - 1) / sysRingCap) * sysRingStep + 12
      : sysBeltStart;
  const userBeltStart = sysBeltMax + 20;

  const ctx: ServerLayoutCtx = {
    serverIndex,
    sysBeltStart,
    sysRingStep,
    sysRingCap,
    sysCount,
    userBeltStart,
    userCount,
  };

  apps.forEach((app, j) => {
    app.r = planetRadius(app.ramRequestMB, app.raw.cpuRequestM, app.kind);
    if (app.kind === 'system') applySystemAppOrbit(app, j, ctx);
    else applyUserAppOrbit(app, j, ctx);
    buildAppMoons(app);
  });
}

function planetRadius(ramMB: number, cpuM: number, kind: 'user' | 'system'): number {
  const ram = Math.max(0, ramMB);
  const cpu = Math.max(0, cpuM);
  const score = ram / 128 + cpu / 100;
  if (kind === 'system') {
    return Math.max(3, Math.min(10, 3 + Math.sqrt(score) * 2.4));
  }
  return Math.max(5, Math.min(24, 4 + Math.sqrt(score) * 5));
}

export function buildScene(data: TopologyResponseDto): GalaxyNode[] {
  const total = data.clusters.length;
  return data.clusters.map((cluster, ci) => {
    const pos = galaxyPosition(ci, total);
    const galaxy: GalaxyNode = {
      id: cluster.id,
      name: cluster.name,
      displayName: cluster.displayName,
      color: GALAXY_COLORS[hashId(cluster.id) % GALAXY_COLORS.length],
      x: pos.x,
      y: pos.y,
      r: galaxyRadius(cluster),
      servers: [],
      apps: [],
    };

    // Place servers around galaxy center
    const N = cluster.servers.length;
    galaxy.servers = cluster.servers.map((s, i) => {
      const a = (i / Math.max(1, N)) * Math.PI * 2 - Math.PI / 2;
      const d = N === 1 ? 0 : galaxy.r * 0.42;
      return {
        id: s.id,
        name: s.name,
        raw: s,
        galaxy,
        role: s.role,
        x: galaxy.x + Math.cos(a) * d,
        y: galaxy.y + Math.sin(a) * d,
        r: 22,
      };
    });

    // Tally primary apps per server (for star sizing)
    const primaryCounts: Record<string, number> = {};
    for (const a of cluster.apps) {
      primaryCounts[a.primaryServerId] = (primaryCounts[a.primaryServerId] || 0) + 1;
    }
    for (const s of galaxy.servers) {
      s.r = 22 + Math.min((primaryCounts[s.id] || 0) * 1.4, 26);
    }

    // Build app nodes grouped by primary server
    const serverById = new Map<string, ServerNode>(galaxy.servers.map((s) => [s.id, s]));
    const primaryAppsByServer: Record<string, AppNode[]> = {};

    for (const ap of cluster.apps) {
      const primary = serverById.get(ap.primaryServerId);
      if (!primary) continue; // server contract violation; skip defensively

      const replicaServers: AppNode['replicaServers'] = [];
      for (const r of ap.replicas) {
        const sv = serverById.get(r.serverId);
        if (sv) replicaServers.push({ server: sv, count: r.count });
      }

      // Color is always category-driven so each planet keeps its identity.
      // System apps are visually demoted by the renderer (dimmer glow + slate outline).
      const color = CATEGORY_COLORS[ap.category] ?? CATEGORY_COLORS.web;

      const node: AppNode = {
        id: ap.id,
        raw: ap,
        galaxy,
        primaryServer: primary,
        replicaServers,
        category: ap.category,
        kind: ap.kind,
        status: ap.status,
        color,
        slug: ap.slug,
        ramRequestMB: ap.ramRequestMB,
        replicaCount: ap.replicaCount,
        oR: 0,
        oA: 0,
        oS: 0,
        r: 6,
        x: 0,
        y: 0,
        moons: [],
        ringLevel: 0,
      };

      primaryAppsByServer[primary.id] ??= [];
      primaryAppsByServer[primary.id].push(node);
      galaxy.apps.push(node);
    }

    galaxy.servers.forEach((server, i) => {
      layoutServerApps(server, i, primaryAppsByServer[server.id] ?? []);
    });

    return galaxy;
  });
}
