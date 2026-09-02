/**
 * Strips leading and trailing '-' runs without a regex. A regex equivalent
 * (`/^-+|-+$/` or the two-pass `/^-+/` + `/-+$/`) is flagged by static
 * analysis as backtracking-risky even though it isn't in practice, so this
 * does the same trim with a plain index scan.
 */
export function stripHyphenEdges(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '-') start++;
  while (end > start && value[end - 1] === '-') end--;
  return value.slice(start, end);
}
