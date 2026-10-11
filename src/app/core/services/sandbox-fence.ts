export const SANDBOX_ROUTE_FORBIDDEN = 'SANDBOX_ROUTE_FORBIDDEN';

export const SANDBOX_NOT_IN_TRIAL =
  'This part of Flui is not included in the trial. Your own applications and databases are real and yours to change.';

export interface FenceRule {
  method: string;
  segments: string[];
}

const segmentsOf = (path: string): string[] => path.split('/').filter(Boolean);

/** `GET /applications/:id/**` as the API's `/sandbox/limits` lists it. */
export function parseFenceRule(route: string): FenceRule | null {
  const [method, path] = route.trim().split(/\s+/, 2);
  if (!method || !path) return null;
  return { method: method.toUpperCase(), segments: segmentsOf(path) };
}

/**
 * The API's own reading of a pattern against a path, loose on `:param`: it may
 * let through a call the API then refuses, never the other way round.
 */
export function fenceAllows(rules: readonly FenceRule[], method: string, path: string): boolean {
  const target = segmentsOf(path.split('?')[0]);
  const verb = method.toUpperCase();
  return rules.some((rule) => {
    if (rule.method !== verb && !(verb === 'HEAD' && rule.method === 'GET')) return false;
    const p = rule.segments;
    for (let i = 0; i < p.length; i++) {
      if (p[i] === '**') return target.length > i;
      if (i >= target.length) return false;
      if (p[i].startsWith(':')) continue;
      if (p[i] !== target[i]) return false;
    }
    return p.length === target.length;
  });
}
