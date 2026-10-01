import type { AppBackupDecision, AppCoverageRow } from '../../service/fleet.service';
import { unprotectedWhy } from './app-recap-view';

export interface DecisionPolicy {
  policyId: string;
  name: string;
  enabled: boolean;
}

export interface DecisionSource {
  coverage?: AppCoverageRow | null;
  policies: DecisionPolicy[];
}

export interface PolicyLink {
  name: string;
  path: string;
}

export type DecisionPanel =
  | { state: 'unprotected'; why: string | null; protectPath: string | null }
  | { state: 'decided'; note: string | null; by: string; running: PolicyLink[] };

/** "Dawit · 1 Oct 2026": who decided, and when. */
export function decidedByLine(decision: AppBackupDecision): string {
  const when = new Date(decision.decidedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return [decision.decidedByName, when].filter(Boolean).join(' · ');
}

/**
 * The panel at the top of the Backup tab: why an app holding data is not
 * protected and what to do about it, or the decision not to back it up.
 */
export function decisionPanel(source: DecisionSource | null | undefined): DecisionPanel | null {
  const c = source?.coverage;
  if (!c?.holdsData || c.category === 'system') return null;
  if (c.coverage === 'not_backed_up_by_choice' && c.decision) {
    return {
      state: 'decided',
      note: c.decision.note ?? null,
      by: decidedByLine(c.decision),
      running: (source?.policies ?? [])
        .filter((p) => p.enabled)
        .map((p) => ({ name: p.name, path: `/management/backup/policies/${p.policyId}` })),
    };
  }
  if (c.coverage !== 'unprotected') return null;
  return {
    state: 'unprotected',
    why: unprotectedWhy(c.pending?.reason, c.reason),
    protectPath: c.protectPath,
  };
}
