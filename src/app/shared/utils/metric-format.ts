/** Formatting shared by the cluster metric views, so a byte is written the same way everywhere. */

const GIB = 1024 ** 3;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

export function formatRate(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond == null) return '—';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : `${value.toFixed(digits)}%`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Middle value of the window — a reference a single spike cannot move. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How the live reading compares with the typical one over the window.
 *
 * `current` is the value on screen, taken from the live poll — the window's
 * own last sample can be minutes old, and comparing that against the median
 * describes a moment nobody is looking at. The reference is the median rather
 * than the first sample: one arbitrary point an hour ago is noise, and on a
 * volatile series like a byte rate it produces a change as large as the value
 * itself. Formatted in the value's own unit, and flattened to ±0 inside a
 * deadband proportional to the reading, so jitter does not read as movement.
 *
 * Callers withhold it entirely when the window no longer reaches the present:
 * a delta against a stale window is worse than no delta.
 */
export function formatDelta(
  current: number,
  values: number[],
  format: (value: number) => string = (value) => value.toFixed(1)
): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (values.length < 3) return { text: '', tone: 'flat' };

  const reference = median(values);
  const change = current - reference;
  const deadband = Math.max(0.05, Math.abs(reference) * 0.02);
  if (Math.abs(change) < deadband) return { text: '\u00b10', tone: 'flat' };

  const sign = change > 0 ? '+' : '\u2212';
  return { text: `${sign}${format(Math.abs(change))}`, tone: change > 0 ? 'up' : 'down' };
}
