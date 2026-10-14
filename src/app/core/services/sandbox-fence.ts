export const SANDBOX_ROUTE_FORBIDDEN = 'SANDBOX_ROUTE_FORBIDDEN';

export const SANDBOX_SIGN_IN_REQUIRED = 'SANDBOX_SIGN_IN_REQUIRED';

/** A visitor who has not signed in asked for something only a signed-in guest may do. */
export function isSignInRequired(error: unknown): boolean {
  const e = error as { status?: unknown; error?: { code?: unknown } } | null;
  return e?.status === 401 && e.error?.code === SANDBOX_SIGN_IN_REQUIRED;
}

export const VISITOR_GONE = 'VISITOR_GONE';

export const VISITOR_MERGED = 'VISITOR_MERGED';

export type VisitEnd = 'gone' | 'merged';

/** The API says this visitor's session is over: the visit ended, or it became an account. */
export function visitEndOf(error: unknown): VisitEnd | null {
  const e = error as { status?: unknown; error?: { code?: unknown } } | null;
  if (e?.status !== 401) return null;
  if (e.error?.code === VISITOR_GONE) return 'gone';
  if (e.error?.code === VISITOR_MERGED) return 'merged';
  return null;
}

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

const READ_VERBS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The API's rule for a visitor who has not signed in: every read the fence
 * admits, and only the writes a rule marks for visitors.
 */
export function visitorMustSignIn(
  visitorRules: readonly FenceRule[],
  method: string,
  path: string,
): boolean {
  if (READ_VERBS.has(method.toUpperCase())) return false;
  return !fenceAllows(visitorRules, method, path);
}
