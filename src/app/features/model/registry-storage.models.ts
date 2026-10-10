export type RegistryBucketProvider =
  | 'scaleway_object_storage'
  | 'ovh_object_storage'
  | 'generic_s3'
  | 'minio';

export interface RegistryApplicationUsage {
  applicationId: string;
  name: string;
  bytes: number;
}

export interface RegistryUsage {
  measuredAt: string;
  totalBytes: number;
  alertBytes: number | null;
  capacityBytes: number | null;
  alerting: boolean;
  applications: RegistryApplicationUsage[];
  unreadable: number;
}

export interface RegistryStorageStatus {
  backend: 'filesystem' | 's3';
  connected: boolean;
  provider?: RegistryBucketProvider;
  endpoint?: string;
  region?: string;
  bucket?: string;
  connectedAt?: string;
  usage?: RegistryUsage;
}

export interface RegistryBucket {
  id: string;
  provider: string;
  region: string;
  bucket: string;
  active: boolean;
  createdByFlui: boolean;
  connectedAt: string;
}

export interface RegistryBucketRemoval {
  bucket: string;
  bucketDeleted: boolean;
}

export const REGISTRY_TRAFFIC_WINDOWS = ['1h', '24h', '7d', '30d'] as const;
export type RegistryTrafficWindow = (typeof REGISTRY_TRAFFIC_WINDOWS)[number];

export interface RegistryTraffic {
  window: string;
  requests: { pulls: number; pushes: number; deletes: number };
  outcomes: { ok: number; refused: number; notFound: number; failed: number };
  bytesIn: number;
  bytesOut: number;
  peakBytesPerSecondIn: number;
  peakBytesPerSecondOut: number;
  readFromBucketBytes: number | null;
}

export function formatMbitPerSecond(bytesPerSecond: number): string {
  const mbit = (bytesPerSecond * 8) / 1e6;
  if (mbit === 0) return '0 Mbit/s';
  if (mbit < 0.1) return '<0.1 Mbit/s';
  return `${mbit.toFixed(mbit >= 100 ? 0 : 1)} Mbit/s`;
}

export const SCALEWAY_REGISTRY_REGIONS = ['fr-par', 'nl-ams', 'pl-waw'] as const;
export type ScalewayRegistryRegion = (typeof SCALEWAY_REGISTRY_REGIONS)[number];

export const SCALEWAY_REGION_LABELS: Record<ScalewayRegistryRegion, string> = {
  'fr-par': 'Paris (fr-par)',
  'nl-ams': 'Amsterdam (nl-ams)',
  'pl-waw': 'Warsaw (pl-waw)',
};

export interface ConnectRegistryBucket {
  provider: RegistryBucketProvider;
  endpoint: string;
  region: string;
  bucket: string;
  prefix?: string;
  forcePathStyle?: boolean;
  accessKey: string;
  secretKey: string;
}

export const OWN_BUCKET_PROVIDERS: RegistryBucketProvider[] = [
  'ovh_object_storage',
  'scaleway_object_storage',
  'generic_s3',
  'minio',
];

const PROVIDER_LABELS: Record<RegistryBucketProvider, string> = {
  scaleway_object_storage: 'Scaleway',
  ovh_object_storage: 'OVH',
  generic_s3: 'S3-compatible',
  minio: 'MinIO',
};

export function registryProviderLabel(provider: string | undefined): string {
  if (!provider) return 'Bucket';
  return PROVIDER_LABELS[provider as RegistryBucketProvider] ?? provider;
}

const MIB = 1024 * 1024;
const GIB = MIB * 1024;

export function formatRegistrySize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes >= 100 * GIB ? 0 : 1)} GiB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(bytes >= 100 * MIB ? 0 : 1)} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

export type UsageGauge =
  | { kind: 'capacity'; limitBytes: number; percent: number; alertPercent: number | null }
  | { kind: 'alert'; limitBytes: number; percent: number }
  | { kind: 'none' };

function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function usageGauge(usage: RegistryUsage): UsageGauge {
  if (usage.capacityBytes != null && usage.capacityBytes > 0) {
    return {
      kind: 'capacity',
      limitBytes: usage.capacityBytes,
      percent: percentOf(usage.totalBytes, usage.capacityBytes),
      alertPercent:
        usage.alertBytes != null ? percentOf(usage.alertBytes, usage.capacityBytes) : null,
    };
  }
  if (usage.alertBytes != null && usage.alertBytes > 0) {
    return {
      kind: 'alert',
      limitBytes: usage.alertBytes,
      percent: percentOf(usage.totalBytes, usage.alertBytes),
    };
  }
  return { kind: 'none' };
}

export function measuredAgo(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 'at an unknown time';
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}
