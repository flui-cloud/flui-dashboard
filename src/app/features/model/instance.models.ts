import { InstanceDto } from '../../core/api';

/**
 * Flui-cloud managed instance labels
 */
export interface FluiLabels {
  'managed-by'?: string;
  'flui-cluster-id'?: string;
  'flui-cluster-name'?: string;
  'flui-environment'?: string;
  'flui-node-id'?: string;
  'flui-node-type'?: string;
  'flui-resource-type'?: string;
  [key: string]: string | undefined;
}

/**
 * Extended InstanceDto with labels support
 */
export interface InstanceWithLabels extends InstanceDto {
  metadata?: {
    labels?: FluiLabels;
  };
}

/**
 * Check if an instance is managed by flui-cloud platform
 */
export function isManagedByFlui(instance: InstanceWithLabels): boolean {
  return instance.metadata?.labels?.['managed-by'] === 'flui-cloud';
}

export type InstanceOwnership = 'self' | 'other-flui' | 'unmanaged';

/**
 * Ownership relative to the installation this dashboard is connected to.
 * Prefers the server-computed `ownership` field; falls back to the managed-by
 * label for older API responses (which cannot tell self from other-flui).
 */
export function getOwnership(instance: InstanceWithLabels): InstanceOwnership {
  const ownership = instance.ownership;
  if (
    ownership === 'self' ||
    ownership === 'other-flui' ||
    ownership === 'unmanaged'
  ) {
    return ownership;
  }
  return isManagedByFlui(instance) ? 'self' : 'unmanaged';
}

/**
 * Get cluster information from instance labels
 */
export function getClusterInfo(instance: InstanceWithLabels): {
  clusterId?: string;
  clusterName?: string;
  nodeType?: string;
} | null {
  const labels = instance.metadata?.labels;
  if (!labels || !isManagedByFlui(instance)) {
    return null;
  }

  return {
    clusterId: labels['flui-cluster-id'],
    clusterName: labels['flui-cluster-name'],
    nodeType: labels['flui-node-type'],
  };
}

/**
 * Resolve the Cluster node ID for a worker instance.
 * The DELETE /clusters/:id/workers/:nodeId endpoint expects the
 * cluster-node UUID (not the underlying server/instance id), which
 * Flui exposes as the `flui-node-id` label.
 */
export function getClusterNodeId(instance: InstanceWithLabels): string | null {
  const labelId = instance.metadata?.labels?.['flui-node-id'];
  if (labelId) return labelId;
  return instance.id ?? null;
}

/**
 * Map ServerResponseDto to InstanceWithLabels
 * Used to display cluster nodes from servers API
 */
export function mapServerToInstance(server: any): InstanceWithLabels {
  return {
    id: server.id,
    userId: server.userId || '',
    name: server.name,
    displayName: server.name,
    type: 'virtual' as any,
    provider: server.provider,
    providerId: server.provider_resource_id,
    status: server.status,
    dataCenter: server.location,
    region: server.location,
    regionName: server.location,
    cpuCores: server.cpu_cores || 0,
    ramMb: server.ram_mb || 0,
    diskMb: server.disk_gb ? server.disk_gb * 1024 : 0,
    osType: server.os_type,
    ipConfig: {
      v4: server.ipv4 ? { ip: server.ipv4, gateway: '', netmaskCidr: 24 } : undefined,
      v6: server.ipv6 ? { ip: server.ipv6, gateway: '', netmaskCidr: 64 } : undefined,
    },
    createdAt: server.created_at || new Date().toISOString(),
    updatedAt: server.updated_at || new Date().toISOString(),
    metadata: {
      labels: server.labels?.reduce((acc: any, label: any) => {
        acc[label.key] = label.value;
        return acc;
      }, {} as FluiLabels),
    },
  };
}
