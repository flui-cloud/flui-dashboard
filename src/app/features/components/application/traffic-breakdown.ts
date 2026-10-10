export const BREAKDOWN_ROWS = 4;

export interface Breakdown<T> {
  rows: T[];
  hidden: number;
}

/**
 * What a status-code or method box shows: the busiest entries, at most four,
 * so the two boxes keep the same height. Entries with no requests stay behind
 * "Show all", unless nothing had any: then the first four still fill the box.
 */
export function breakdownOf<T extends { requests_per_second: number | null }>(
  entries: T[],
  all: boolean,
): Breakdown<T> {
  const rate = (entry: T) => entry.requests_per_second ?? 0;
  const sorted = [...entries].sort((a, b) => rate(b) - rate(a));
  if (all) return { rows: sorted, hidden: 0 };
  const busy = sorted.filter((entry) => rate(entry) > 0);
  const rows = (busy.length ? busy : sorted).slice(0, BREAKDOWN_ROWS);
  return { rows, hidden: sorted.length - rows.length };
}
