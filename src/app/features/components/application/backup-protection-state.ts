import { StatusTone } from '../../../ui/primitives/status';

export interface ProtectionState {
  tone: StatusTone;
  label: string;
  detail: string | null;
}

interface StateSource {
  protectedOffCluster: boolean;
  policies: { lastRun: { status: string } | null }[];
  coverage?: { lastSuccessAt: string | null } | null;
}

const SUCCEEDED = /^(succeeded|success|completed)$/i;
const AT_RISK = 'If the cluster is lost, so is its data.';

export function protectionState(
  p: StateSource,
  hasData: boolean,
  database: boolean,
): ProtectionState {
  if (!hasData) {
    return {
      tone: 'neutral',
      label: 'Nothing to back up',
      detail: 'This application keeps no data of its own: redeploying it brings it back as it was.',
    };
  }
  if (p.protectedOffCluster) return { tone: 'success', label: 'Protected', detail: null };
  if (!p.policies.length) {
    return {
      tone: 'neutral',
      label: 'Not configured',
      detail: `Nothing of this ${database ? 'database' : 'application'} is copied to backup storage. ${AT_RISK}`,
    };
  }
  const ran = p.policies.some((pol) => !!pol.lastRun);
  const succeeded = p.coverage
    ? !!p.coverage.lastSuccessAt
    : p.policies.some((pol) => SUCCEEDED.test(pol.lastRun?.status ?? ''));
  if (!succeeded) {
    return ran
      ? {
          tone: 'error',
          label: 'Never succeeded',
          detail: `No backup has reached backup storage yet, see why below. ${AT_RISK}`,
        }
      : { tone: 'neutral', label: 'Never succeeded', detail: 'The first backup has not run yet.' };
  }
  return {
    tone: 'warning',
    label: 'Out of date',
    detail: `Its backups did not reach backup storage recently, see why below. ${AT_RISK}`,
  };
}

export function coverageReasonState(reason: string): { tone: StatusTone; label: string } {
  switch (reason) {
    case 'never_succeeded':
      return { tone: 'error', label: 'Never succeeded' };
    case 'no_policy':
    case 'no_schedule':
      return { tone: 'neutral', label: 'Not configured' };
    default:
      return { tone: 'warning', label: 'Out of date' };
  }
}

export function runTone(status: string | null | undefined): StatusTone {
  if (!status) return 'neutral';
  if (SUCCEEDED.test(status)) return 'success';
  if (/fail|error/i.test(status)) return 'error';
  if (/run|progress|pending/i.test(status)) return 'progress';
  return 'neutral';
}

export function runText(status: string): string {
  const words = status.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function shortStamp(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}
