import { RegistryTraffic } from './registry-storage.models';

export interface NodeNow {
  clusterId: string;
  clusterName: string;
  node: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  mbpsOut: number;
  mbpsIn: number;
  monthPaceBytes: number;
  includedTb: number | null;
}

export interface EdgeNow {
  clusterId: string;
  clusterName: string;
  rpsNow: number;
  rpsBefore: number;
  rateLimited10m: number;
  requests10m: number;
  serverErrors10m: number;
}

export interface PlatformComponentNow {
  name: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  restartsLastHour: number;
}

export interface SandboxNow {
  live: number;
  warm: number;
  ceiling: number;
  waiting: number;
  fullRefusals: number;
}

export interface AlertsNow {
  firing: number;
  critical: number;
  names: string[];
}

export interface TrafficThresholds {
  nodeMbps: number;
  monthlyTrafficPercent: number;
  spikeFactor: number;
  spikeMinRps: number;
  rateLimitedPer10m: number;
  edgeErrorPercent: number;
}

export type RegistryHourNow = Omit<RegistryTraffic, 'window'> & { window?: string };

export interface InstallationNow {
  measuredAt: string;
  nodes: NodeNow[];
  edges: EdgeNow[];
  platform: PlatformComponentNow[];
  registry: RegistryHourNow | null;
  sandbox: SandboxNow | null;
  alerts: AlertsNow;
  thresholds: TrafficThresholds;
}

export type Level = 'ok' | 'warn' | 'bad';

export const TB = 1e12;
const CPU_WARN = 75;
const MEMORY_WARN = 80;
const USAGE_BAD = 90;

function usageLevel(percent: number | null, warn: number): Level {
  if (percent == null) return 'ok';
  if (percent >= USAGE_BAD) return 'bad';
  return percent >= warn ? 'warn' : 'ok';
}

export const cpuLevel = (percent: number | null): Level => usageLevel(percent, CPU_WARN);
export const memoryLevel = (percent: number | null): Level => usageLevel(percent, MEMORY_WARN);

export function isSurge(edge: EdgeNow, t: TrafficThresholds): boolean {
  return (
    t.spikeFactor > 0 &&
    edge.rpsNow >= t.spikeMinRps &&
    edge.rpsNow >= t.spikeFactor * Math.max(edge.rpsBefore, 0.01)
  );
}

export function isRateLimited(edge: EdgeNow, t: TrafficThresholds): boolean {
  return t.rateLimitedPer10m > 0 && edge.rateLimited10m >= t.rateLimitedPer10m;
}

export function edgeErrorPercent(edge: EdgeNow): number | null {
  return edge.requests10m > 0 ? (edge.serverErrors10m / edge.requests10m) * 100 : null;
}

export function isEdgeFailing(edge: EdgeNow, t: TrafficThresholds): boolean {
  const percent = edgeErrorPercent(edge);
  return percent !== null && t.edgeErrorPercent > 0 && percent >= t.edgeErrorPercent;
}

export function isLinkBusy(node: NodeNow, t: TrafficThresholds): boolean {
  return t.nodeMbps > 0 && Math.max(node.mbpsOut, node.mbpsIn) >= t.nodeMbps;
}

export function monthSharePercent(node: NodeNow): number | null {
  if (!node.includedTb) return null;
  return (node.monthPaceBytes / (node.includedTb * TB)) * 100;
}

export function isMonthHeavy(node: NodeNow, t: TrafficThresholds): boolean {
  const share = monthSharePercent(node);
  return share !== null && t.monthlyTrafficPercent > 0 && share >= t.monthlyTrafficPercent;
}

export function monthPaceLabel(node: NodeNow): string {
  if (node.includedTb == null) return 'not metered';
  return `${(node.monthPaceBytes / TB).toFixed(1)} of ${node.includedTb} TB`;
}

export function formatPercent(percent: number | null): string {
  return percent == null ? '–' : `${Math.round(percent)}%`;
}

export function formatRate(value: number): string {
  if (value === 0) return '0';
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}
