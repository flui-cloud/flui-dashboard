import { InstanceWithLabels, getClusterInfo, getClusterNodeId } from '../../model/instance.models';
import { ServerMetricsState } from '../../service/cluster-monitoring.service';

export const OVERVIEW_NODE_LIMIT = 6;

export interface OverviewNodeRow {
  id: string;
  name: string;
  role: string | null;
  serverType: string | null;
  architecture: string | null;
  location: string | null;
  cpu: number | null;
  memory: number | null;
  statusLabel: string | null;
  failed: boolean;
  dot: string;
  link: string[] | null;
}

/**
 * The node's own status, not the machine's: the values here are
 * `creating | joining | ready | error | deleting`, while `running` and `off`
 * describe the server at the provider. A node whose bootstrap failed is still
 * `running` there, so a provider status must never read as healthy.
 */
export function nodeStatusDot(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'ready':
      return 'dot-healthy';
    case 'error':
      return 'dot-degraded';
    default:
      return 'dot-pending';
  }
}

export function meterBarClass(value: number, warn: number, danger: number): string {
  if (value >= danger) return 'bg-red-500';
  if (value >= warn) return 'bg-orange-400';
  return 'bg-green-500';
}

export function findNodeMetrics(
  node: InstanceWithLabels,
  servers: readonly ServerMetricsState[],
): ServerMetricsState | undefined {
  const keys = new Set(
    [getClusterNodeId(node), node.id, node.name, node.displayName, node.providerId].filter(
      (k): k is string => !!k,
    ),
  );
  const byId = servers.find((s) => keys.has(s.serverId));
  if (byId) return byId;
  const ips = new Set([node.ipConfig?.v4?.ip, ...(node.additionalIps ?? [])].filter((ip): ip is string => !!ip));
  if (ips.size === 0) return undefined;
  return servers.find((s) => ips.has(s.instance.split(':')[0]));
}

function serverTypeOf(node: InstanceWithLabels): string | null {
  if (node.productName) return node.productName;
  if (node.productType) return node.productType;
  if (!node.cpuCores) return null;
  const ram = node.ramMb ? ` · ${Math.round(node.ramMb / 1024)} GB` : '';
  return `${node.cpuCores} vCPU${ram}`;
}

function locationOf(node: InstanceWithLabels): string | null {
  const isByos = (node.provider as string) === 'byos';
  if (isByos) return null;
  const region = node.regionName || node.region;
  if (node.dataCenter && node.dataCenter !== region && node.dataCenter !== node.region) {
    return region ? `${region} · ${node.dataCenter}` : node.dataCenter;
  }
  return region || null;
}

function linkOf(node: InstanceWithLabels): string[] | null {
  if ((node.provider as string) === 'byos' || !node.provider || !node.providerId) return null;
  return ['/infrastructure/compute', node.provider, node.providerId];
}

export function buildOverviewNodeRow(
  node: InstanceWithLabels,
  servers: readonly ServerMetricsState[],
): OverviewNodeRow {
  const metrics = findNodeMetrics(node, servers);
  const status = node.status ? String(node.status) : null;
  const failed = status?.toLowerCase() === 'error';
  return {
    id: node.id,
    name: node.displayName || node.name || node.id,
    role: getClusterInfo(node)?.nodeType ?? null,
    serverType: serverTypeOf(node),
    architecture: node.architecture ?? null,
    location: locationOf(node),
    cpu: metrics ? metrics.cpu.current : null,
    memory: metrics ? metrics.memory.current : null,
    statusLabel: failed ? 'never joined' : status,
    failed,
    dot: nodeStatusDot(status ?? undefined),
    link: linkOf(node),
  };
}

export function buildOverviewNodeRows(
  nodes: readonly InstanceWithLabels[],
  servers: readonly ServerMetricsState[],
  limit = OVERVIEW_NODE_LIMIT,
): OverviewNodeRow[] {
  const ordered = [...nodes].sort(
    (a, b) => Number(getClusterInfo(b)?.nodeType === 'master') - Number(getClusterInfo(a)?.nodeType === 'master'),
  );
  return ordered.slice(0, limit).map((node) => buildOverviewNodeRow(node, servers));
}
