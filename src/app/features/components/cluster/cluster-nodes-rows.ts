import { MenuAction } from '../../../ui/overlays/actions-menu';
import { StatusTone } from '../../../ui/primitives/status';
import { InstanceWithLabels, getClusterInfo, getOwnership } from '../../model/instance.models';
import { ServerMetricsState } from '../../service/cluster-monitoring.service';
import { findNodeMetrics } from './cluster-overview-nodes';

export interface NodeRow {
  readonly node: InstanceWithLabels;
  readonly name: string;
  readonly altName: string | null;
  readonly role: string;
  readonly isMaster: boolean;
  readonly tone: StatusTone;
  readonly stateLabel: string;
  readonly size: string;
  readonly cpu: number | null;
  readonly cpuAside: string;
  readonly memory: number | null;
  readonly memoryAside: string;
  readonly ip: string | null;
  readonly removeDisabled: boolean;
  readonly removeReason: string | null;
  readonly menu: MenuAction[];
  readonly menuTitle: string | null;
}

export interface NodeRowOptions {
  readonly canResize: boolean;
  readonly isByos: boolean;
  readonly minNodes: number | null | undefined;
}

const PROGRESS = new Set([
  'creating',
  'joining',
  'provisioning',
  'starting',
  'stopping',
  'rebuilding',
  'migrating',
  'deleting',
  'pending',
]);

export function nodeStateTone(status: string): StatusTone {
  if (status === 'ready') return 'success';
  if (status === 'error') return 'error';
  if (PROGRESS.has(status)) return 'progress';
  return 'neutral';
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown';
}

export function formatMemoryMb(mb: number): string {
  if (!mb) return '—';
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
}

function sizeOf(node: InstanceWithLabels): string {
  if (node.productName) return node.productName;
  if (node.productType) return node.productType;
  return '—';
}

export function isMasterNode(node: InstanceWithLabels): boolean {
  return getClusterInfo(node)?.nodeType === 'master';
}

function removeState(
  isMaster: boolean,
  status: string,
  atMin: boolean,
  minNodes: number | null | undefined,
): { removeDisabled: boolean; removeReason: string | null } {
  if (isMaster)
    return {
      removeDisabled: true,
      removeReason: 'The master node cannot be removed from this view.',
    };
  if (status === 'deleting' || status === 'error')
    return { removeDisabled: true, removeReason: `Worker is in '${status}' state.` };
  if (atMin)
    return {
      removeDisabled: true,
      removeReason: `Removing this worker would violate minNodes=${minNodes}.`,
    };
  return { removeDisabled: false, removeReason: null };
}

function menuOf(
  node: InstanceWithLabels,
  isMaster: boolean,
  removeDisabled: boolean,
  options: NodeRowOptions,
): MenuAction[] {
  const items: MenuAction[] = [];
  if (getOwnership(node) === 'self') items.push({ id: 'details', label: 'View details' });
  if (options.canResize) items.push({ id: 'resize', label: 'Resize' });
  if (!isMaster && options.isByos) {
    items.push({
      id: 'remove',
      label: 'Remove worker',
      danger: true,
      disabled: removeDisabled,
      separatorBefore: items.length > 0,
    });
  }
  return items;
}

export function buildNodeRows(
  nodes: readonly InstanceWithLabels[],
  servers: readonly ServerMetricsState[],
  options: NodeRowOptions,
): NodeRow[] {
  const workers = nodes.filter((n) => !isMasterNode(n));
  const atMin = options.minNodes != null && workers.length <= options.minNodes;
  return nodes.map((node) => {
    const isMaster = isMasterNode(node);
    const status = (node.status || '').toString().toLowerCase();
    const { removeDisabled, removeReason } = removeState(isMaster, status, atMin, options.minNodes);
    const metrics = findNodeMetrics(node, servers);
    const menu = menuOf(node, isMaster, removeDisabled, options);
    const removable = menu.some((item) => item.id === 'remove');
    const name = node.displayName || node.name || node.id || '';
    return {
      node,
      name,
      altName: node.displayName && node.name && node.displayName !== node.name ? node.name : null,
      role: capitalize(getClusterInfo(node)?.nodeType ?? 'node'),
      isMaster,
      tone: nodeStateTone(status),
      stateLabel: capitalize(status),
      size: sizeOf(node),
      cpu: metrics ? metrics.cpu.current : null,
      cpuAside: node.cpuCores ? `${node.cpuCores} vCPU` : '',
      memory: metrics ? metrics.memory.current : null,
      memoryAside: formatMemoryMb(node.ramMb),
      ip: node.ipConfig?.v4?.ip ?? null,
      removeDisabled,
      removeReason,
      menu,
      menuTitle: removable && removeDisabled ? removeReason : null,
    };
  });
}
