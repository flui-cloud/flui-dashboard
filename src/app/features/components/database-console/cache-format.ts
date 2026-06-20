import { CacheEntry, CacheServerInfo } from '../../model/cache-console.models';

export function isJson(e: CacheEntry): boolean {
  if (e.encoding !== 'utf8') return false;
  const t = e.value.trim();
  if (!t || (!t.startsWith('{') && !t.startsWith('['))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

export function formatValue(e: CacheEntry): string {
  if (!isJson(e)) return e.value;
  try {
    return JSON.stringify(JSON.parse(e.value.trim()), null, 2);
  } catch {
    return e.value;
  }
}

export function hitRatio(s: CacheServerInfo): string {
  const total = s.getHits + s.getMisses;
  if (!total) return '—';
  return `${((s.getHits / total) * 100).toFixed(1)}%`;
}

export function uptime(sec: number): string {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || '<1m';
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function consoleError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
