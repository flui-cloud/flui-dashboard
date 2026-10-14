import { TurnstileFailed } from './turnstile.service';

export type VisitorRefusal = 'closed' | 'limit' | 'challenge' | 'error';

export function visitorRefusalLine(reason: string | null): string {
  switch (reason) {
    case 'closed':
      return 'The demo is closed right now. You can still sign in.';
    case 'limit':
      return 'The demo is busy right now. Try again in a minute, or sign in.';
    case 'challenge':
      return 'We could not check this browser. Try again, or sign in.';
    default:
      return 'The demo did not open. Try again in a minute, or sign in.';
  }
}

export function visitorRefusalOf(error: unknown): VisitorRefusal {
  const e = error as { status?: unknown; error?: { code?: unknown } } | null;
  const code = e?.error?.code;
  if (code === 'SANDBOX_VISITORS_CLOSED' || e?.status === 503) return 'closed';
  if (code === 'SANDBOX_VISITORS_LIMIT' || e?.status === 429) return 'limit';
  if (code === 'SANDBOX_VISITOR_CHALLENGE_FAILED' || e?.status === 403) return 'challenge';
  if (error instanceof TurnstileFailed) return 'challenge';
  return 'error';
}
