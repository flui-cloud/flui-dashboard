import type { MigrationRow } from '../../service/migration.service';

export function typeLabel(type: MigrationRow['type']): string {
  return { app: 'App', db: 'Database', full: 'Full' }[type];
}

export function typeBadgeClass(type: MigrationRow['type']): string {
  switch (type) {
    case 'app':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'db':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300';
    case 'full':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300';
  }
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
  }
  if (s === 'bridging') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300';
  }
  if (s === 'failed' || s === 'failed_forward' || s === 'aborted') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400';
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
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
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
