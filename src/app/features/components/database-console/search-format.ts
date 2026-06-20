export function consoleError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatRaw(r: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): string {
  const head = `${r.method} ${r.path}`;
  return r.body && Object.keys(r.body).length
    ? `${head}\n${JSON.stringify(r.body, null, 2)}`
    : head;
}
