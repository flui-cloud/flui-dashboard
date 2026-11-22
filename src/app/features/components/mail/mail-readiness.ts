import { StatusTone } from '../../../ui/primitives/status';
import { MailReadinessStep, READINESS_STEP_LABEL } from '../../model/mail-console.models';

export function stepLabel(step: MailReadinessStep): string {
  return READINESS_STEP_LABEL[step.id] ?? step.id;
}

export function stepTone(step: MailReadinessStep): StatusTone {
  switch (step.status) {
    case 'satisfied':
      return 'success';
    case 'pending':
      return 'progress';
    case 'automatable':
      return 'neutral';
    default:
      return 'warning';
  }
}

export function stepStatus(step: MailReadinessStep): string {
  switch (step.status) {
    case 'satisfied':
      return 'Done';
    case 'pending':
      return 'Provider is checking';
    case 'automatable':
      return 'Flui can do this';
    default:
      return 'Needs you';
  }
}
