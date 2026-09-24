import { DecisionOperation } from '../../model/scaling-group.models';

/** What became of the machine a decision ordered or gave back, in one word or two. */
export function operationLabel(op: DecisionOperation): string {
  switch (op.state) {
    case 'running':
      return `In progress · ${op.progress}%`;
    case 'pending':
      return 'Queued';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
    default:
      return 'Cancelled';
  }
}

/** The step while it runs, the error once it failed, nothing once it is over. */
export function operationDetail(op: DecisionOperation): string | null {
  if (op.state === 'failed') return op.error;
  return op.state === 'running' || op.state === 'pending' ? op.step : null;
}

export function operationTone(state: DecisionOperation['state']): string {
  if (state === 'failed') return 'font-medium text-red-600 dark:text-red-400';
  if (state === 'completed') return 'font-medium status-healthy';
  return 'font-medium text-sky-600 dark:text-sky-400';
}
