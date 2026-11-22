import type { StatusTone } from '../../../ui/primitives/status';
import type { PackagesPatStatus } from '../../../core/services/github-app-oauth.service';

export interface AvailableRepo {
  id: string;
  fullName: string;
  description?: string | null;
  private: boolean;
  isImported: boolean;
  language?: string | null;
  defaultBranch: string;
  updatedAt: string;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: 'Next.js',
  angular: 'Angular',
  react: 'React',
  vue: 'Vue.js',
  nestjs: 'NestJS',
  nuxt: 'Nuxt',
};

export function frameworkLabel(framework: string): string {
  return FRAMEWORK_LABELS[framework] || framework;
}

function parseUtc(date: string): Date {
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(date) ? date : date + 'Z';
  return new Date(normalized);
}

export function formatRelativeDate(date: string): string {
  const then = parseUtc(date);
  const diffMs = Date.now() - then.getTime();

  if (diffMs < 60_000) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 7) return rtf.format(-diffDays, 'day');
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDay(date: string): string {
  return parseUtc(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function githubAppConfigUrl(appSlug: string | null | undefined): string {
  const raw = typeof appSlug === 'string' ? appSlug : '';
  const marker = '/apps/';
  const markerIdx = raw.lastIndexOf(marker);
  const afterApps = markerIdx >= 0 ? raw.slice(markerIdx + marker.length) : raw;
  const slashIdx = afterApps.indexOf('/');
  const slug = (slashIdx >= 0 ? afterApps.slice(0, slashIdx) : afterApps) || 'flui-cloud';
  return `https://github.com/apps/${slug}/installations/new`;
}

export function filterAvailableRepos<T extends AvailableRepo>(repos: T[], query: string): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return repos;
  return repos.filter(
    (repo) =>
      repo.fullName.toLowerCase().includes(q) ||
      (repo.description ?? '').toLowerCase().includes(q) ||
      (repo.language ?? '').toLowerCase().includes(q),
  );
}

export function patStatusLabel(pat: PackagesPatStatus | null): string {
  switch (pat?.status) {
    case 'VALID':
      return 'Valid';
    case 'EXPIRING_SOON':
      return 'Expiring soon';
    case 'EXPIRED':
      return 'Expired';
    case 'INVALID':
      return 'Invalid';
    case 'UNKNOWN_EXPIRY':
      return 'Expiration unknown';
    case 'MISSING':
      return 'Not configured';
    default:
      return pat?.configured ? 'Configured' : 'Not configured';
  }
}

export function patStatusTone(pat: PackagesPatStatus | null): StatusTone {
  switch (pat?.status) {
    case 'VALID':
      return 'success';
    case 'EXPIRING_SOON':
    case 'UNKNOWN_EXPIRY':
      return 'warning';
    case 'EXPIRED':
    case 'INVALID':
      return 'error';
    default:
      return pat?.configured ? 'neutral' : 'warning';
  }
}

function plural(n: number): string {
  return `${n} ${n === 1 ? 'repository' : 'repositories'}`;
}

export function importedMessage(imported: number): string {
  return `${plural(imported)} imported.`;
}

export function allFailedMessage(failed: number, errors: string[] | undefined): string {
  const detail = errors && errors.length > 0 ? errors.join('; ') : 'No repository was imported';
  return `${plural(failed)} failed to import: ${detail}.`;
}

export function partialImportMessage(
  imported: number,
  failed: number,
  errors: string[] | undefined,
): string {
  const detail = errors && errors.length > 0 ? ` Errors: ${errors.join('; ')}.` : '';
  return `${plural(imported)} imported, ${failed} failed.${detail}`;
}

export function errorText(err: unknown, fallback: string): string {
  const e = err as { error?: { message?: string }; message?: string } | null;
  return e?.error?.message || e?.message || fallback;
}
