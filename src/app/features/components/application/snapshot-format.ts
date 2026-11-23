import { StatusTone } from '../../../ui/primitives/status';
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
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB');
}

export function kindLabel(snap: ApplicationSnapshot): string {
  return getSnapshotKind(snap);
}

export function kindTooltip(snap: ApplicationSnapshot): string {
  return getSnapshotKind(snap) === 'native'
    ? 'CSI VolumeSnapshot — block-level diff against the source volume.'
    : 'A full file-level copy of the volume, taking as much space again on the same storage.';
}

export function statusLabel(snap: ApplicationSnapshot): string {
  const st = snapshotStatus(snap);
  if (st === 'PENDING') {
    return getSnapshotKind(snap) === 'clone' ? 'Copying data…' : 'Snapshotting…';
  }
  if (st === 'DELETING') return 'Deleting…';
  if (st === 'READY') return 'Ready';
  return 'Failed';
}

export function sizeLine(snap: ApplicationSnapshot): string {
  return snapshotSizeLabel(snap).headline;
}

export function sizeSubline(snap: ApplicationSnapshot): string | null {
  return snapshotSizeLabel(snap).subline;
}

export function statusTone(status: SnapshotStatus): StatusTone {
  switch (status) {
    case 'READY':
      return 'success';
    case 'FAILED':
      return 'error';
    default:
      return 'progress';
  }
}
