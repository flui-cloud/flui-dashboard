import {
  ApplicationSnapshot,
  SnapshotStatus,
  getSnapshotKind,
  snapshotSizeLabel,
  snapshotStatus,
} from '../../model/volume-management.models';

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function kindLabel(snap: ApplicationSnapshot): string {
  return getSnapshotKind(snap);
}

export function kindTooltip(snap: ApplicationSnapshot): string {
  return getSnapshotKind(snap) === 'native'
    ? 'CSI VolumeSnapshot — block-level diff against the source volume.'
    : 'Copy-pod fallback — full file-level copy of the PVC, consumes equivalent space in the shared volume.';
}

export function kindBadgeClass(snap: ApplicationSnapshot): string {
  return getSnapshotKind(snap) === 'native'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
}

export function statusLabel(snap: ApplicationSnapshot): string {
  const st = snapshotStatus(snap);
  if (st === 'PENDING') {
    return getSnapshotKind(snap) === 'clone' ? 'Copying data…' : 'Snapshotting…';
  }
  if (st === 'DELETING') return 'Deleting…';
  if (st === 'READY') return 'Ready';
  return st;
}

export function sizeLine(snap: ApplicationSnapshot): string {
  return snapshotSizeLabel(snap).headline;
}

export function sizeSubline(snap: ApplicationSnapshot): string | null {
  return snapshotSizeLabel(snap).subline;
}

export function statusClass(status: SnapshotStatus): string {
  switch (status) {
    case 'READY':
      return 'text-green-600 dark:text-green-400 font-medium';
    case 'PENDING':
      return 'text-blue-600 dark:text-blue-400';
    case 'FAILED':
      return 'text-red-600 dark:text-red-400 font-medium';
    case 'DELETING':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}
