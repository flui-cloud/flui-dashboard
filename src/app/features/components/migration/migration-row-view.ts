import type { MigrationRow } from '../../service/migration.service';

export function typeLabel(type: MigrationRow['type']): string {
  return { app: 'App', db: 'Database', full: 'Full' }[type];
}

export function typeBadgeClass(type: MigrationRow['type']): string {
  switch (type) {
    case 'app':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'db':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'full':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (s === 'bridging') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (s === 'failed' || s === 'failed_forward' || s === 'aborted') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (
    s === 'ready' ||
    s === 'synced' ||
    s === 'pending' ||
    s === 'provisioning' ||
    s === 'db_replicating' ||
    s === 'app_staging' ||
    s === 'cutover'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-border bg-muted text-muted-foreground';
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}

export function sourceLabel(row: MigrationRow): string {
  switch (row.type) {
    case 'app':
    case 'db':
      return shortId(row.srcAppId);
    case 'full':
      return shortId(row.appId);
  }
}
