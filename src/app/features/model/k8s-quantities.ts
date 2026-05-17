/**
 * Helpers to convert between the K8s-standard resource strings the catalog
 * manifest uses ("500m", "2Gi") and the numeric units ms / Mi that the
 * `/resource-availability` endpoint expects as query params. Also exposes
 * validators mirroring the backend regex so the FE can block invalid override
 * strings before the POST install round-trip.
 */

export function parseCpuToMillicores(value: string | undefined | null): number {
  if (!value) return 0;
  const t = value.trim();
  if (t.endsWith('m')) return Number.parseInt(t.slice(0, -1), 10) || 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 1000) : 0;
}

export function parseMemoryToMi(value: string | undefined | null): number {
  if (!value) return 0;
  const m = /^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(value.trim());
  if (!m) return 0;
  const n = Number.parseFloat(m[1]);
  switch (m[2]) {
    case 'Ki': return Math.round(n / 1024);
    case 'Mi': return Math.round(n);
    case 'Gi': return Math.round(n * 1024);
    case 'Ti': return Math.round(n * 1024 * 1024);
    // Decimal units — convert to Mi using decimal → binary approximation.
    case 'K':  return Math.round((n * 1000) / (1024 * 1024));
    case 'M':  return Math.round((n * 1000 * 1000) / (1024 * 1024));
    case 'G':  return Math.round((n * 1000 * 1000 * 1000) / (1024 * 1024));
    case 'T':  return Math.round((n * 1000 * 1000 * 1000 * 1000) / (1024 * 1024));
    default:   return Math.round(n);
  }
}

export function formatCpuFromMc(mc: number): string {
  if (!Number.isFinite(mc) || mc <= 0) return '';
  if (mc % 1000 === 0) return `${mc / 1000}`;
  return `${mc}m`;
}

export function formatMemoryFromMi(mi: number): string {
  if (!Number.isFinite(mi) || mi <= 0) return '';
  if (mi >= 1024 * 1024 && mi % (1024 * 1024) === 0) return `${mi / (1024 * 1024)}Ti`;
  if (mi >= 1024 && mi % 1024 === 0) return `${mi / 1024}Gi`;
  return `${mi}Mi`;
}

/** Matches the backend DTO regex: `250m`, `1`, `2.5`. */
export const CPU_QUANTITY_REGEX = /^(\d+m|\d+(\.\d+)?)$/;
/** Matches the backend DTO regex: `512Mi`, `2Gi`, `1.5Gi`, bare `2` etc. */
export const MEMORY_QUANTITY_REGEX = /^\d+(\.\d+)?(Ki|Mi|Gi|Ti|K|M|G|T)?$/;

export function isValidCpuString(value: string | undefined | null): boolean {
  if (!value) return false;
  return CPU_QUANTITY_REGEX.test(value.trim());
}

export function isValidMemoryString(value: string | undefined | null): boolean {
  if (!value) return false;
  return MEMORY_QUANTITY_REGEX.test(value.trim());
}
