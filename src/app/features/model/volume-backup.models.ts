import { formatBytes } from './volume-management.models';

/** One volume backup, as `GET /applications/:id/volume-backups` lists it. */
export interface VolumeBackup {
  id: string;
  volumeName: string | null;
  engine: 'kopia' | 'rclone' | 'pvc-clone' | 'unknown';
  createdAt: string | null;
  kept: 'retention' | 'until-deleted';
  logicalBytes: number | null;
  uploadedBytes: number | null;
  stored: 'present' | 'expired' | 'missing' | 'unknown';
  encrypted: boolean;
  restorable: boolean;
  browsable: boolean;
  reason: string | null;
  quiesce: string | null;
  snapshotId: string | null;
  destinationId: string | null;
}

export interface VolumeBackupFileEntry {
  name: string;
  type: 'directory' | 'file' | 'symlink' | 'other';
  size: number | null;
  modifiedAt: string | null;
  mode: string | null;
  consistentCopy?: boolean;
}

export interface VolumeBackupListing {
  backupId: string;
  path: string;
  isFile: boolean;
  entries: VolumeBackupFileEntry[];
}

export interface VolumeBackupRestoreRequest {
  targetApplicationId?: string;
  volumeName?: string;
}

export interface VolumeBackupRestoreResult {
  operationId: string;
  engine: 'kopia' | 'rclone';
  targetApplicationId: string;
  newPvcName: string;
  replaces: string | null;
}

export interface VolumeFilesRestoreRequest {
  paths: string[];
  targetDirectory?: string;
  targetApplicationId?: string;
  volumeName?: string;
}

export interface VolumeFilesRestoreResult {
  operationId: string;
  targetApplicationId: string;
  volumeName: string;
  paths: string[];
  targetDirectory: string | null;
}

/** Clones on the cluster are listed with the volume copies, not here. */
export function offClusterBackups(list: VolumeBackup[]): VolumeBackup[] {
  return list.filter((b) => b.engine !== 'pvc-clone');
}

export function backupTriggerLabel(b: VolumeBackup): string {
  return b.kept === 'retention' ? 'Scheduled' : 'Manual · kept';
}

export function backupTriggerTitle(b: VolumeBackup): string {
  return b.kept === 'retention'
    ? 'Taken by a backup policy and removed by its retention'
    : 'Kept until someone deletes it';
}

export function bytesOrDash(bytes: number | null): string {
  return formatBytes(bytes ?? undefined) ?? '—';
}

export function joinBackupPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

export function parentBackupPath(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function backupPathCrumbs(
  path: string,
): { label: string; path: string }[] {
  const segments = path.split('/').filter(Boolean);
  return segments.map((label, i) => ({
    label,
    path: segments.slice(0, i + 1).join('/'),
  }));
}

/** A path already covered by a selected folder above it is not sent twice. */
export function collapseSelection(paths: Iterable<string>): string[] {
  const sorted = [...new Set(paths)].sort((a, b) => a.length - b.length);
  const kept: string[] = [];
  for (const p of sorted) {
    if (!kept.some((k) => p.startsWith(`${k}/`))) kept.push(p);
  }
  return kept.sort((a, b) => a.localeCompare(b));
}
