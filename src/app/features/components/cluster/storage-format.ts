import { StatusTone } from '../../../ui/primitives/status';
import { ClusterStorageStatusDto } from '../../../core/api/model/clusterStorageStatusDto';
import {
  ApplicationSnapshot,
  SnapshotStatus,
  getSnapshotKind,
  snapshotSizeLabel,
  snapshotStatus,
} from '../../model/volume-management.models';

type StatusEnum = ClusterStorageStatusDto.StatusEnum;

export interface StorageStatusView {
  readonly label: string;
  readonly tone: StatusTone;
  readonly summary: string;
}

export const STORAGE_STATUS: Record<StatusEnum, StorageStatusView> = {
  READY: {
    label: 'Ready',
    tone: 'success',
    summary: 'Shared storage is healthy and serving PVCs.',
  },
  DEGRADED: {
    label: 'Degraded',
    tone: 'warning',
    summary: 'Configuration is in place, but live PVC status could not be fetched.',
  },
  PROVISIONING: {
    label: 'Provisioning',
    tone: 'progress',
    summary: 'Cluster is still being created. Storage is not observable yet.',
  },
  DISABLED: {
    label: 'Disabled',
    tone: 'neutral',
    summary: 'Shared storage is disabled: the cluster is using the flui-local fallback.',
  },
  ERROR: {
    label: 'Error',
    tone: 'error',
    summary: 'Shared storage is in an error state.',
  },
  UNKNOWN: {
    label: 'Unknown',
    tone: 'neutral',
    summary: 'Storage status could not be determined.',
  },
};

export interface StorageSnapshotRow {
  readonly snap: ApplicationSnapshot;
  readonly kind: string;
  readonly tone: StatusTone;
  readonly label: string;
  readonly size: string;
  readonly created: string;
}

const SNAPSHOT_TONE: Record<SnapshotStatus, StatusTone> = {
  READY: 'success',
  PENDING: 'progress',
  FAILED: 'error',
  DELETING: 'progress',
};

function snapshotLabel(st: SnapshotStatus): string {
  if (st === 'PENDING') return 'Copying…';
  if (st === 'DELETING') return 'Deleting…';
  if (st === 'READY') return 'Ready';
  return st;
}

export function formatStorageDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB');
}

export function storageSnapshotRow(snap: ApplicationSnapshot): StorageSnapshotRow {
  const st = snapshotStatus(snap);
  const { headline, subline } = snapshotSizeLabel(snap);
  return {
    snap,
    kind: getSnapshotKind(snap),
    tone: SNAPSHOT_TONE[st] ?? 'neutral',
    label: snapshotLabel(st),
    size: subline ? `${headline} (${subline})` : headline,
    created: formatStorageDate(snap.createdAt),
  };
}
