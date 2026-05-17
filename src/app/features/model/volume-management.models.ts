/**
 * Volume management models.
 *
 * Local types for application snapshots since the OpenAPI spec currently
 * returns `Observable<any>` for snapshot endpoints. Shape mirrors the
 * backend `SnapshotResponse` (ExportSummary + provider context) returned by
 * GET /applications/:id/snapshots.
 */

export type SnapshotProvider = 'hetzner' | 'scaleway' | 'contabo';

export type SnapshotSink = 'pvc-clone' | 's3-archive';

/**
 * UI-side derived status. The backend reports a `ready: boolean` and the
 * service marks rows being deleted client-side. PENDING means "ready=false".
 * FAILED is reserved for future use when the backend surfaces a terminal
 * error flag; right now it is not emitted.
 */
export type SnapshotStatus = 'PENDING' | 'READY' | 'FAILED' | 'DELETING';

export interface ApplicationSnapshot {
  /** Stable id used in the URL (DELETE /applications/:id/snapshots/:exportId). */
  exportId: string;
  /** Underlying mechanism. `pvc-clone` = full PVC clone (the only one used by the in-cluster snapshot path today). */
  sink: SnapshotSink;
  /** Source PVC name. Undefined when listing s3-archive exports that no longer point at a live PVC. */
  sourcePvcName?: string;
  namespace: string;
  appId?: string;
  /** Source PVC declared size in GB (capacity, not actual data). */
  sizeGb?: number;
  /** Actual on-disk bytes at the time of the snapshot, when known. */
  actualBytes?: number;
  createdAt: string;
  /** True once the underlying snapshot is usable. False = copy still running. */
  ready: boolean;
  /** Provider + capabilities echoed by the backend so the UI can pick the right copy. */
  provider: SnapshotProvider;
  labels: Record<string, string>;
  /** Client-only flag set while a delete is in flight. */
  deleting?: boolean;
}

export interface CreateSnapshotRequest {
  volumeName?: string;
  description?: string;
}

/** Compute the UI status from the API booleans + the client-side delete flag. */
export function snapshotStatus(snap: ApplicationSnapshot): SnapshotStatus {
  if (snap.deleting) return 'DELETING';
  return snap.ready ? 'READY' : 'PENDING';
}

/**
 * Human-readable headline + subline for the size column.
 *
 * - When `actualBytes` is known, the headline is the formatted bytes and the
 *   subline is "of N GB available" so users see "uses 4 MiB of 1 GB".
 * - When only `sizeGb` is known (older snapshots that never wrote the
 *   actual-bytes annotation), the headline is "N GB" and the subline is
 *   "PVC capacity" so the value is not mistaken for the data footprint.
 * - When neither is known the headline is "—".
 */
export function snapshotSizeLabel(snap: ApplicationSnapshot): {
  headline: string;
  subline: string | null;
} {
  const used = formatBytes(snap.actualBytes);
  if (used && snap.sizeGb !== undefined) {
    return { headline: used, subline: `of ${snap.sizeGb} GB available` };
  }
  if (used) {
    return { headline: used, subline: null };
  }
  if (snap.sizeGb !== undefined) {
    return { headline: `${snap.sizeGb} GB`, subline: 'PVC capacity' };
  }
  return { headline: '—', subline: null };
}

/**
 * Human-readable bytes formatter (B / KiB / MiB / GiB / TiB).
 * Mirrors the CLI's `formatBytes` so the dashboard shows the same numbers.
 */
export function formatBytes(bytes: number | undefined): string | null {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = unit === 0 ? value.toString() : value.toFixed(1);
  return `${formatted} ${units[unit]}`;
}

export type SnapshotKind = 'native' | 'clone';

export function getSnapshotKind(snap: Pick<ApplicationSnapshot, 'sink'>): SnapshotKind {
  return snap.sink === 'pvc-clone' ? 'clone' : 'native';
}

export type StorageClassState = 'active' | 'fallback';

export interface StorageClassDescriptor {
  name: 'flui-shared' | 'flui-dedicated' | 'flui-local';
  label: string;
  description: string;
  state: StorageClassState;
}

export const STORAGE_CLASSES: StorageClassDescriptor[] = [
  {
    name: 'flui-shared',
    label: 'Shared storage',
    description:
      'The default. Disk lives on the master node and is shared with every other node. Good for almost everything: web apps, queues, file uploads, caches.',
    state: 'active',
  },
  {
    name: 'flui-dedicated',
    label: 'Pinned storage',
    description:
      'Disk lives on one specific node and the app stays on that node. Used by databases that need real disk guarantees (Postgres, MariaDB, Valkey, PocketBase). The catalog picks this automatically when needed.',
    state: 'active',
  },
  {
    name: 'flui-local',
    label: 'Local fallback',
    description:
      'When shared storage is turned off, every app uses the local disk of whatever node it lands on. Data is not portable between nodes.',
    state: 'fallback',
  },
];
