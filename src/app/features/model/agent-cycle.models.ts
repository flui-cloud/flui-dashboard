
export type ActionBinding = Record<string, string>;

export const PROPOSAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  CONSUMED: 'CONSUMED',
  DENIED: 'DENIED',
} as const;

export type ProposalStatus =
  (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

export const PROPOSAL_DECISION = {
  ONCE: 'once',
  ALWAYS: 'always',
  DENY: 'deny',
} as const;

export type ProposalDecision =
  (typeof PROPOSAL_DECISION)[keyof typeof PROPOSAL_DECISION];

export interface AgentProposal {
  id: string;
  keyId?: string | null;
  action: string;
  routePath?: string | null;
  binding?: ActionBinding | null;
  argsDigest: string;
  sentence: string;
  offersAlways: boolean;
  estimateRef?: string | null;
  estimate?: Record<string, unknown> | null;
  status: ProposalStatus;
  expiresAt?: string | null;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  concessionId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentConcession {
  id: string;
  keyId?: string | null;
  action: string;
  binding?: ActionBinding | null;
  sentence: string;
  fromProposalId?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
}

export interface ConcessionOperation {
  id: string;
  operationType: string;
  status: string;
  progress?: number | null;
  resourceName?: string | null;
  startedAt?: string | null;
}

export interface DecideResult {
  proposal: AgentProposal;
  concession: AgentConcession | null;
}

export interface RevokeResult {
  concession: AgentConcession;
  stopRequested: string[];
  stillRunning: string[];
}

export function isProposalLive(
  proposal: Pick<AgentProposal, 'status' | 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  if (proposal.status !== PROPOSAL_STATUS.PENDING) return false;
  if (!proposal.expiresAt) return true;
  const at = Date.parse(proposal.expiresAt);
  return Number.isNaN(at) ? false : at > now;
}

export function offersAlways(
  proposal: Pick<AgentProposal, 'offersAlways'>,
): boolean {
  return proposal.offersAlways === true;
}

export function waitingOn(
  proposals: readonly AgentProposal[],
  now: number = Date.now(),
): AgentProposal[] {
  return proposals.filter((p) => isProposalLive(p, now));
}

export function expiredCount(
  proposals: readonly AgentProposal[],
  now: number = Date.now(),
): number {
  return proposals.filter(
    (p) => p.status === PROPOSAL_STATUS.PENDING && !isProposalLive(p, now),
  ).length;
}

export function standingConcessions(
  concessions: readonly AgentConcession[],
): AgentConcession[] {
  return concessions.filter((c) => !c.revokedAt);
}

export function splitAction(action: string): { verb: string; pattern: string } {
  const at = action.indexOf(' ');
  if (at < 0) return { verb: '', pattern: action };
  return { verb: action.slice(0, at), pattern: action.slice(at + 1) };
}

export interface EstimateFact {
  label: string;
  value: string;
  money: boolean;
}

const MONEY = /[€$£]|\bEUR\b|\bUSD\b|\bGBP\b/;
const MAX_FACTS = 8;

export function estimateFacts(value: unknown): EstimateFact[] {
  const out: EstimateFact[] = [];
  const push = (label: string, leaf: unknown): void => {
    if (out.length >= MAX_FACTS) return;
    if (typeof leaf === 'string' && leaf.trim()) {
      out.push({ label, value: leaf, money: MONEY.test(leaf) });
      return;
    }
    if (typeof leaf === 'number' && Number.isFinite(leaf)) {
      out.push({ label, value: String(leaf), money: false });
      return;
    }
    if (typeof leaf === 'boolean') {
      out.push({ label, value: leaf ? 'yes' : 'no', money: false });
    }
  };

  for (const [key, leaf] of entriesOf(value)) {
    if (leaf !== null && typeof leaf === 'object' && !Array.isArray(leaf)) {
      for (const [inner, deep] of entriesOf(leaf)) push(`${key}.${inner}`, deep);
      continue;
    }
    push(key, leaf);
  }
  return out;
}

function entriesOf(value: unknown): [string, unknown][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

export function ceilingSentence(
  isAdmin: boolean,
  permissionCount: number,
): string {
  const held = isAdmin
    ? 'You are an administrator on this instance'
    : permissionCount > 0
      ? `You hold ${permissionCount} permission${permissionCount === 1 ? '' : 's'} on this instance`
      : 'What you hold on this instance decides what you can lend';
  return `${held} — the grants below choose how much of that you lend out, and they cannot reach past it.`;
}
