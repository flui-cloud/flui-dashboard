import { InstanceDto } from '../../core/api';

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

export interface InstanceWithLabels extends InstanceDto {
  metadata?: {
    labels?: FluiLabels;
  };
}

export function isManagedByFlui(instance: InstanceWithLabels): boolean {
  return instance.metadata?.labels?.['managed-by'] === 'flui-cloud';
}

export type InstanceOwnership = 'self' | 'other-flui' | 'unmanaged';

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

export function getClusterNodeId(instance: InstanceWithLabels): string | null {
  const labelId = instance.metadata?.labels?.['flui-node-id'];
  if (labelId) return labelId;
  return instance.id ?? null;
}

export function mapClusterNodeToInstance(
  node: any,
  clusterId: string,
): InstanceWithLabels {
  const ip: string | undefined = node.ipAddress || node.privateIp;
  return {
    id: node.id,
    userId: '',
    name: node.serverName,
    displayName: node.serverName,
    type: 'virtual' as any,
    provider: 'byos' as any,
    providerId: node.providerResourceId || node.id,
    status: node.status,
    dataCenter: 'byos',
    region: 'byos',
    regionName: 'byos',
    cpuCores: 0,
    ramMb: 0,
    diskMb: 0,
    osType: 'linux',
    ipConfig: {
      v4: ip ? { ip, gateway: '', netmaskCidr: 24 } : undefined,
    },
    createdAt: node.createdAt || new Date().toISOString(),
    updatedAt: node.updatedAt || node.createdAt || new Date().toISOString(),
    ownership: 'self' as any,
    metadata: {
      labels: {
        'managed-by': 'flui-cloud',
        'flui-cluster-id': clusterId,
        'flui-resource-type': 'cluster-node',
        'flui-node-id': node.id,
        'flui-node-type': node.nodeType,
      },
    },
  };
}

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
