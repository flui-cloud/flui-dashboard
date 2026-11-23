import { DecisionOperation, ScalingDecision } from '../../model/scaling-group.models';
import { StatusTone } from '../../../ui/primitives';

export const SHAPE_CLASSES = 6;

export type MarkerTone = 'success' | 'warning' | 'danger' | 'accent' | 'muted';

export interface OutcomeMark {
  tone: MarkerTone;
  acted: boolean;
}

export const OUTCOME_MARKS: Record<ScalingDecision['outcome'], OutcomeMark> = {
  added: { tone: 'success', acted: true },
  replaced: { tone: 'accent', acted: true },
  removed: { tone: 'muted', acted: true },
  declined: { tone: 'warning', acted: false },
  alerted: { tone: 'danger', acted: false },
  changed: { tone: 'muted', acted: false },
  'node-ordered': { tone: 'accent', acted: true },
  'node-joined': { tone: 'success', acted: true },
  'purchase-failed': { tone: 'danger', acted: true },
  'node-drained': { tone: 'muted', acted: true },
  'node-removed': { tone: 'muted', acted: true },
};

export function outcomeMark(outcome: ScalingDecision['outcome']): OutcomeMark {
  return OUTCOME_MARKS[outcome] ?? { tone: 'muted', acted: false };
}

export function outcomeStatusTone(outcome: ScalingDecision['outcome']): StatusTone {
  switch (outcome) {
    case 'added':
    case 'replaced':
    case 'node-joined':
      return 'success';
    case 'purchase-failed':
    case 'alerted':
      return 'error';
    case 'declined':
      return 'warning';
    case 'node-ordered':
      return 'progress';
    default:
      return 'neutral';
  }
}

export function operationStatusTone(state: DecisionOperation['state']): StatusTone {
  if (state === 'failed') return 'error';
  if (state === 'completed') return 'success';
  if (state === 'running' || state === 'pending') return 'progress';
  return 'neutral';
}
