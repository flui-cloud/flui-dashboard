import {
  RegistryBucketProvider,
  RegistryStorageStatus,
  RegistryUsage,
  UsageGauge,
  formatRegistrySize,
  registryProviderLabel,
} from '../../model/registry-storage.models';

export interface OwnBucketForm {
  provider: RegistryBucketProvider;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  forcePathStyle: boolean;
  accessKey: string;
  secretKey: string;
}

export function emptyOwnBucketForm(): OwnBucketForm {
  return {
    provider: 'ovh_object_storage',
    endpoint: '',
    region: '',
    bucket: '',
    prefix: '',
    forcePathStyle: false,
    accessKey: '',
    secretKey: '',
  };
}

export function registryLocation(status: RegistryStorageStatus | null): string {
  if (!status) return '';
  if (status.backend === 'filesystem') return 'A volume on the control cluster';
  const provider = registryProviderLabel(status.provider);
  return status.bucket ? `Bucket ${status.bucket} on ${provider}` : `A bucket on ${provider}`;
}

export function registryLimitLine(usage: RegistryUsage | null, gauge: UsageGauge | null): string {
  if (!usage || !gauge) return '';
  if (gauge.kind === 'capacity') {
    const alert =
      usage.alertBytes != null ? ` · alert at ${formatRegistrySize(usage.alertBytes)}` : '';
    return `of ${formatRegistrySize(gauge.limitBytes)} volume${alert}`;
  }
  if (gauge.kind === 'alert') return `alert at ${formatRegistrySize(gauge.limitBytes)}`;
  return 'No space alert set';
}

export function usageThresholds(gauge: UsageGauge): { warnAt: number; criticalAt: number } {
  if (gauge.kind === 'capacity') {
    const warnAt = gauge.alertPercent ?? 80;
    return { warnAt, criticalAt: Math.max(warnAt, 95) };
  }
  return { warnAt: 100, criticalAt: Number.POSITIVE_INFINITY };
}
