import { AvailabilityOutlook } from '../../model/scaling-group.models';
import { StatusTone } from '../../../ui/primitives/status';

export const HOURS_PER_MONTH = 730;

export type CatalogueState = AvailabilityOutlook['state'] | 'unknown';

export const STATE_LABEL: Record<CatalogueState, string> = {
  'sold-out': 'Sold out',
  unknown: 'No reading',
  limited: 'Limited',
  recovered: 'Recovered',
  available: 'Available',
};

export const STATE_TONE: Record<CatalogueState, StatusTone> = {
  'sold-out': 'error',
  unknown: 'neutral',
  limited: 'warning',
  recovered: 'success',
  available: 'success',
};

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
