import { WriteScalingGroup } from '../../model/scaling-group.models';

export interface ConsequenceReading {
  /** The one sentence a person agrees to. Finite, or it cannot be agreed to. */
  sentence: string;
  /** What else is true, each short enough to read in a glance. */
  clauses: string[];
}

/**
 * What turning this on actually means, in the words a person would use.
 *
 * The API asks the same question of its own callers, but the action cycle only
 * intercepts agentic surfaces — a form in a browser meets no such step. This
 * sentence is therefore the only consent that exists for the dashboard. It is
 * said in nodes; the spending ceiling is the safety net under them, required
 * before Flui may buy.
 */
export function consequenceOf(
  draft: WriteScalingGroup,
  currentNodes?: number,
): ConsequenceReading {
  const buys = draft.provision === 'automatic';
  const cap = draft.limits?.maxMonthlyCost ?? null;

  if (!buys) {
    return {
      sentence:
        'Flui will name the machine that would fit and wait for you. It will not add a node or spend anything on its own.',
      clauses: [
        `It looks once a minute, and writes down what it saw either way.`,
        `You can still add and remove nodes by hand, between ${draft.bounds.min} and ${draft.bounds.max}.`,
      ],
    };
  }

  // How much room is being granted: counted from the nodes the cluster has
  // where the caller knows them, and from the maximum itself where it does not.
  const growth =
    currentNodes === undefined
      ? `to at most ${draft.bounds.max} nodes`
      : `by up to ${nodeWord(Math.max(0, draft.bounds.max - currentNodes))}`;
  const ceiling =
    cap == null
      ? 'No spending ceiling is set, so nothing will be bought until one is.'
      : `Under that, it never lets the fleet pass the spending ceiling of €${cap.toFixed(2)} a month.`;
  return {
    sentence: `Flui may grow this cluster ${growth} without asking you again. ${ceiling}`,
    clauses: [
      `It acts only when an app has been stuck for ${draft.settleSeconds ?? 30} seconds.`,
      `It gives a node back when the work fits without it, never going below ${draft.bounds.min}.`,
      `Every decision is written down, whether or not it acted.`,
    ],
  };
}

function nodeWord(count: number): string {
  return count === 1 ? '1 more node' : `${count} more nodes`;
}
