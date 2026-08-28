import { AvailabilityOutlook } from '../../model/scaling-group.models';

export const HOURS_PER_MONTH = 730;

export type CatalogueState = AvailabilityOutlook['state'] | 'unknown';

export const STATE_LABEL: Record<CatalogueState, string> = {
  'sold-out': 'Sold out',
  unknown: 'No reading',
  limited: 'Limited',
  recovered: 'Recovered',
  available: 'Available',
};

export const STATE_PILL: Record<CatalogueState, string> = {
  'sold-out': 'badge-error',
  unknown: 'bg-muted text-muted-foreground',
  limited: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  recovered: 'bg-primary/15 text-primary',
  available: 'badge-success',
};

export const TABLE = {
  card: 'card-surface px-4 py-3',
  scroll: 'overflow-x-auto',
  table: 'w-full min-w-[42rem] border-collapse text-left text-sm',
  captionTop: 'caption-top pb-2 text-left text-[12px] text-muted-foreground',
  headRow: 'border-b border-border text-left text-muted-foreground',
  th: 'whitespace-nowrap py-2 pr-4 align-bottom font-normal',
  thNum: 'whitespace-nowrap px-4 py-2 text-right align-bottom font-normal',
  row: 'border-b border-border/50 last:border-0',
  td: 'py-2 pr-4 align-top text-foreground',
  tdNum: 'px-4 py-2 text-right align-top tabular-nums text-foreground',
  tdMuted: 'py-2 pr-4 align-top text-muted-foreground',
  note: 'm-0 text-[12px] leading-snug text-muted-foreground',
  mono: 'whitespace-nowrap font-mono text-[13px] text-foreground',
  pill:
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
} as const;

export function eurHour(value: number | null): string {
  return value === null ? '—' : `€${value.toFixed(4)}/h`;
}

export function eurMonth(value: number | null): string {
  return value === null ? '—' : `€${value.toFixed(2)}/mo`;
}

export function readingAge(seconds: number | null): string {
  return seconds === null ? 'age unknown' : `${seconds}s ago`;
}

export function heldFor(hours: number | null): string {
  if (hours === null) return '—';
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

export function ago(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}
