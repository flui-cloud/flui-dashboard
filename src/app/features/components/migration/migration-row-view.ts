import type { StatusTone } from '../../../ui/primitives/status';
import type { MigrationRow } from '../../service/migration.service';

export function typeLabel(type: MigrationRow['type']): string {
  return { app: 'App', db: 'Database', full: 'Full' }[type];
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

const DONE = new Set(['completed']);
const FAILED = new Set(['failed', 'failed_forward', 'aborted']);
const MOVING = new Set([
  'bridging',
  'ready',
  'synced',
  'pending',
  'provisioning',
  'db_replicating',
  'app_staging',
  'replicating',
  'cutover',
]);

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (DONE.has(s)) return 'success';
  if (FAILED.has(s)) return 'error';
  return MOVING.has(s) ? 'progress' : 'neutral';
}

export function statusText(status: string): string {
  const label = statusLabel(status.toLowerCase()).replace(/^db\b/, 'DB');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function durationOf(row: MigrationRow, now: number = Date.now()): string {
  const start = row.startedAt ? new Date(row.startedAt).getTime() : Number.NaN;
  if (Number.isNaN(start)) return '—';
  const end = row.finishedAt ? new Date(row.finishedAt).getTime() : now;
  return Number.isNaN(end) ? '—' : formatDuration(end - start);
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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
