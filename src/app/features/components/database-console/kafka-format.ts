export function formatValue(value: string | null): string {
  if (value === null) return '(null)';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function consoleError(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const err = (e as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
