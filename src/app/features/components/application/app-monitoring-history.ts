import type { AppHistoryPoint } from '../../model/application.models';

export const THROTTLE_NOTICE_PERCENT = 25;
const THROTTLE_WINDOW_MS = 15 * 60_000;

export function recentThrottlePercent(points: AppHistoryPoint[]): number | null {
  const timed = points.filter((p) => p.cpu_throttled_percent != null);
  if (timed.length === 0) return null;
  const latest = Math.max(...points.map((p) => Date.parse(p.datetime)).filter(Number.isFinite));
  const since = latest - THROTTLE_WINDOW_MS;
  const recent = timed.filter((p) => Date.parse(p.datetime) >= since);
  if (recent.length === 0) return null;
  return Math.max(...recent.map((p) => p.cpu_throttled_percent!));
}

export function throttleNotice(points: AppHistoryPoint[]): number | null {
  const percent = recentThrottlePercent(points);
  return percent != null && percent >= THROTTLE_NOTICE_PERCENT ? Math.round(percent) : null;
}

export function lastReadinessDip(points: AppHistoryPoint[]): string | null {
  let last: string | null = null;
  let lastAt = -Infinity;
  for (const p of points) {
    if (p.replicas_ready == null || p.replicas_desired == null) continue;
    if (p.replicas_ready >= p.replicas_desired) continue;
    const at = Date.parse(p.datetime);
    if (Number.isFinite(at) && at > lastAt) {
      lastAt = at;
      last = p.datetime;
    }
  }
  return last;
}
