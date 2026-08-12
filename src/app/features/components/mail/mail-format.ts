const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const DAY_TIME = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return isToday(at) ? `today at ${TIME.format(at)}` : DAY_TIME.format(at);
}

export function shortWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return isToday(at) ? TIME.format(at) : DAY_TIME.format(at);
}

export function bucketLabel(iso: string, bucket: 'hour' | 'day'): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return bucket === 'hour' ? TIME.format(at) : DAY.format(at);
}

function isToday(at: Date): boolean {
  const now = new Date();
  return (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()
  );
}

export function consoleError(error: unknown): string {
  const err = error as { error?: { message?: string }; message?: string; status?: number };
  return (
    err?.error?.message ??
    err?.message ??
    (err?.status ? `Request failed (${err.status})` : 'Request failed')
  );
}
