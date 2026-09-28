export type AuditActorKind = 'user' | 'key' | 'agent' | 'system';

export type AuditOutcome = 'ok' | 'refused' | 'failed';

export interface AuditEvent {
  id: string;
  at: string;
  userId: string | null;
  email: string | null;
  actorKind: AuditActorKind;
  actorKeyId: string | null;
  action: string;
  target: Record<string, string> | null;
  status: number | null;
  outcome: AuditOutcome;
  permission: string | null;
  dataAccess: boolean;
}

export type AuditPeriod = '24h' | '7d' | '30d';

export interface AuditFilter {
  email?: string;
  dataAccessOnly?: boolean;
  refusedOnly?: boolean;
  period?: AuditPeriod;
  limit?: number;
}

export const AUDIT_PERIOD_LABELS: Record<AuditPeriod, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/;

export function isAuditEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function auditTargetText(target: Record<string, string> | null): string {
  if (!target) return '';
  return Object.entries(target)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
}
