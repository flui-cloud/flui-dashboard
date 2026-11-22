import { ConfirmOptions } from '../../../ui/overlays/confirm';
import {
  AgentProposal,
  EstimateFact,
  PROPOSAL_DECISION,
  ProposalDecision,
} from '../../model/agent-cycle.models';

export function riskOf(
  proposal: AgentProposal,
  decision: ProposalDecision,
  facts: readonly EstimateFact[],
): ConfirmOptions | null {
  const sentence = proposal.sentence.trim() || 'do what it asked';
  if (decision === PROPOSAL_DECISION.ALWAYS) {
    return {
      title: 'Allow this always?',
      body: `Your agent will be able to ${sentence} without asking, until you revoke it under Granted permanently.`,
      confirmLabel: 'Allow always',
    };
  }
  if (decision !== PROPOSAL_DECISION.ONCE) return null;
  const costs = facts.filter((fact) => fact.money).map((fact) => fact.value);
  if (!proposal.consequence && costs.length === 0) return null;
  const parts = [proposal.consequence?.trim(), costs.length ? `Cost: ${costs.join(', ')}.` : null];
  return {
    title: 'Allow this request?',
    body: parts.filter(Boolean).join(' '),
    confirmLabel: 'Allow once',
  };
}
