import { CatalogInstallResponseDto } from '../../../core/api/model/models';
import { StatusTone } from '../../../ui/primitives/status';

export interface CatalogLinks {
  website?: string;
  docs?: string;
  source?: string;
}

interface Ratings {
  wow?: number;
  utility?: number;
  euFit?: number;
  community?: number;
}

export interface RatingRow {
  key: keyof Ratings;
  label: string;
  value: number;
}

export interface ToneLabel {
  tone: StatusTone;
  label: string;
}

export type DetailTab = 'description' | 'configuration' | 'manifest';

export const DETAIL_TABS: readonly { key: DetailTab; label: string }[] = [
  { key: 'description', label: 'Overview' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'manifest', label: 'Manifest' },
];

const RATING_LABELS: readonly { key: keyof Ratings; label: string }[] = [
  { key: 'wow', label: 'Wow' },
  { key: 'utility', label: 'Utility' },
  { key: 'euFit', label: 'EU fit' },
  { key: 'community', label: 'Community' },
];

export function linksOf(raw: object | undefined): CatalogLinks {
  return (raw as CatalogLinks | undefined) ?? {};
}

export function ratingRows(raw: object | undefined): RatingRow[] {
  const ratings = raw as Ratings | undefined;
  if (!ratings) return [];
  return RATING_LABELS.flatMap(({ key, label }) => {
    const value = ratings[key];
    return typeof value === 'number' ? [{ key, label, value }] : [];
  });
}

export function ratingScore(raw: object | undefined): number | null {
  const rows = ratingRows(raw);
  if (rows.length === 0) return null;
  const avg = rows.reduce((sum, r) => sum + r.value, 0) / rows.length;
  return Math.round(avg * 10) / 10;
}

function sentence(status: string): string {
  const words = status.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function appState(status: string): ToneLabel {
  const label = sentence(status);
  switch (status) {
    case 'running':
      return { tone: 'success', label };
    case 'failed':
      return { tone: 'error', label };
    case 'degraded':
    case 'waiting_for_room':
      return { tone: 'warning', label };
    case 'stopped':
    case 'deleted':
      return { tone: 'neutral', label };
    default:
      return { tone: 'progress', label };
  }
}

const INSTALL_STATES: Record<CatalogInstallResponseDto.StatusEnum, ToneLabel> = {
  PENDING: { tone: 'progress', label: 'Pending' },
  INSTALLING: { tone: 'progress', label: 'Installing' },
  RUNNING: { tone: 'success', label: 'Running' },
  FAILED: { tone: 'error', label: 'Failed' },
  UNINSTALLING: { tone: 'progress', label: 'Uninstalling' },
  UNINSTALLED: { tone: 'neutral', label: 'Uninstalled' },
};

export function installState(status: CatalogInstallResponseDto.StatusEnum): ToneLabel {
  return INSTALL_STATES[status] ?? { tone: 'neutral', label: sentence(String(status)) };
}

export function installQueryParams(
  slug: string,
  autoConnectTo: string | null,
): Record<string, string> {
  const params: Record<string, string> = { catalogSlug: slug };
  if (autoConnectTo) params['autoConnectTo'] = autoConnectTo;
  return params;
}
