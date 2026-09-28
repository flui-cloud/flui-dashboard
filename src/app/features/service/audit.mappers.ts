import {
  AuditActorKind,
  AuditEvent,
  AuditFilter,
  AuditOutcome,
  AuditPeriod,
} from '../model/audit.model';

export interface ApiAuditEvent {
  id: string;
  at: string;
  userId: string | null;
  email: string | null;
  actorKind: string | null;
  actorKeyId: string | null;
  action: string;
  target: Record<string, string> | null;
  status: number | null;
  outcome: string;
  permission: string | null;
  dataAccess: boolean;
}

const ACTOR_KINDS = new Set<AuditActorKind>(['user', 'key', 'agent', 'system']);
const OUTCOMES = new Set<AuditOutcome>(['ok', 'refused', 'failed']);

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<AuditPeriod, number> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
};

function actorKindOf(
  kind: AuditActorKind,
  email: string | null | undefined,
): AuditActorKind {
  if (ACTOR_KINDS.has(kind)) return kind;
  return email ? 'user' : 'system';
}

export function toAuditEvent(e: ApiAuditEvent): AuditEvent {
  const kind = (e.actorKind ?? '').toLowerCase() as AuditActorKind;
  const outcome = (e.outcome ?? '').toLowerCase() as AuditOutcome;
  return {
    id: e.id,
    at: e.at,
    userId: e.userId ?? null,
    email: e.email ?? null,
    actorKind: actorKindOf(kind, e.email),
    actorKeyId: e.actorKeyId ?? null,
    action: e.action,
    target: e.target ?? null,
    status: e.status ?? null,
    outcome: OUTCOMES.has(outcome) ? outcome : 'failed',
    permission: e.permission ?? null,
    dataAccess: !!e.dataAccess,
  };
}

export function toAuditParams(
  f: AuditFilter,
  now: number = Date.now(),
): Record<string, string> {
  const params: Record<string, string> = {};
  const email = f.email?.trim();
  if (email) params['email'] = email;
  if (f.period)
    params['since'] = new Date(now - PERIOD_MS[f.period]).toISOString();
  if (f.dataAccessOnly) params['dataAccess'] = 'true';
  if (f.refusedOnly) params['outcome'] = 'refused';
  if (f.limit) params['limit'] = String(f.limit);
  return params;
}
