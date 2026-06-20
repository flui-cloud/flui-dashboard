import { QueueMessage } from '../../model/messaging-console.models';

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

export function isJsonPayload(m: QueueMessage): boolean {
  if (m.encoding !== 'utf8') return false;
  const t = m.data.trim();
  if (!t || (!t.startsWith('{') && !t.startsWith('['))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

export function formatPayload(m: QueueMessage): string {
  if (!isJsonPayload(m)) return m.data;
  try {
    return JSON.stringify(JSON.parse(m.data.trim()), null, 2);
  } catch {
    return m.data;
  }
}

export function exampleSubject(pattern: string): string {
  return pattern
    .split('.')
    .map((t) => (t === '*' || t === '>' || t === '#' ? 'new' : t))
    .join('.');
}

export function consoleError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
