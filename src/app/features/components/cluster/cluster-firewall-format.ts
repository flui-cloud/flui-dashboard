import { FirewallRuleDto } from '../../../core/api/model/firewallRuleDto';
import { StatusTone } from '../../../ui/primitives/status';

export interface ToneLabel {
  readonly tone: StatusTone;
  readonly label: string;
}

const RECONCILIATION: Record<string, ToneLabel> = {
  PENDING: { tone: 'neutral', label: 'Pending' },
  IN_SYNC: { tone: 'success', label: 'In sync' },
  DRIFT: { tone: 'warning', label: 'Drift detected' },
  RECONCILING: { tone: 'progress', label: 'Reconciling' },
  ERROR: { tone: 'error', label: 'Failed' },
};

const DRIFT: Record<string, ToneLabel> = {
  DRIFT: { tone: 'warning', label: 'Desired state differs from applied state' },
  PENDING: { tone: 'neutral', label: 'Never reconciled' },
  ERROR: { tone: 'error', label: 'Reconciliation failed' },
};

export function reconciliationState(status: string | null | undefined): ToneLabel {
  return RECONCILIATION[status ?? ''] ?? { tone: 'neutral', label: 'Unknown' };
}

export function driftState(hasDrift: boolean, status: string | null | undefined): ToneLabel {
  if (!hasDrift) return { tone: 'success', label: 'In sync with provider' };
  return DRIFT[status ?? ''] ?? { tone: 'warning', label: 'State may be out of sync' };
}

export function canReconcile(status: string | null | undefined): boolean {
  return status === 'DRIFT' || status === 'PENDING' || status === 'ERROR';
}

export function ruleTargets(rule: FirewallRuleDto): string {
  const ips = rule.direction === 'in' ? rule.sourceIps : rule.destinationIps;
  if (!ips?.length) return '—';
  return ips.slice(0, 2).join(', ') + (ips.length > 2 ? ` +${ips.length - 2}` : '');
}

export function timeSince(timestamp?: string): string {
  if (!timestamp) return 'Never';
  const diffInMinutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes === 1) return '1 minute ago';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return '1 day ago';
  return `${diffInDays} days ago`;
}
