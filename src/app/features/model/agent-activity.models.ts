
export type ActorKind = 'user' | 'key' | 'agent' | 'unknown';

export type ActivityUnder = 'concession' | 'approval';

export interface AgentActivityOperation {
  id: string;
  operationType: string | null;
  status: string;
  progress: number;
  resourceType: string | null;
  resourceName: string | null;
  resourceId: string | null;
  currentStep: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelRequestedAt: string | null;
  grantId: string | null;
}

export interface AgentActivityEntry {
  id: string;
  at: string;
  userId: string;
  tool: string;
  scope: string;
  allowed: boolean;
  outcome: string | null;
  error: string | null;
  actorKind: ActorKind | null;
  actorKeyId: string | null;
  actorKeyName: string | null;
  actorKeyRevoked: boolean | null;
  args: Record<string, unknown> | null;
  operationId: string | null;
  operation: AgentActivityOperation | null;
  under: ActivityUnder | null;
  underSentence: string | null;
}

export type ActivityScope = 'own' | 'instance';

export interface AgentActivityPage {
  scope: ActivityScope;
  total: number;
  limit: number;
  offset: number;
  entries: AgentActivityEntry[];
}

export interface AgentIdentityActivity {
  actorKind: ActorKind | null;
  actorKeyId: string | null;
  actorKeyName: string | null;
  actorKeyRevoked: boolean | null;
  keyLastUsedAt: string | null;
  userId: string;
  lastActivityAt: string;
  lastTool: string | null;
  lastOutcome: string | null;
  lastAllowed: boolean | null;
  calls: number;
  refused: number;
}

export interface AgentIdentityActivityPage {
  scope: ActivityScope;
  identities: AgentIdentityActivity[];
}

export interface AgentIdentity {
  userId: string;
  userName: string;
  name?: string | null;
  fluiUserId: string | null;
}

export function actorRef(entry: {
  actorKeyId: string | null;
  userId: string;
}): string {
  return entry.actorKeyId ? `key:${entry.actorKeyId}` : `account:${entry.userId}`;
}

export function namedActor(
  entry: { actorKeyId: string | null; actorKeyName?: string | null; userId: string },
  keyNames: Readonly<Record<string, string>>,
  identityNames: Readonly<Record<string, string>>,
): string | null {
  if (entry.actorKeyName) return entry.actorKeyName;
  if (entry.actorKeyId) return keyNames[entry.actorKeyId] ?? null;
  return identityNames[entry.userId] ?? null;
}

export function identityNamesByAccount(
  identities: readonly AgentIdentity[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const identity of identities) {
    if (!identity.fluiUserId) continue;
    out[identity.fluiUserId] = identity.name ?? identity.userName;
  }
  return out;
}

export type UnderTone = 'standing' | 'once' | 'refused' | 'asked' | 'untraced';

export interface UnderLabel {
  tone: UnderTone;
  text: string;
  detail: string;
}

export function underLabel(entry: {
  allowed: boolean;
  outcome: string | null;
  under: ActivityUnder | null;
  underSentence: string | null;
}): UnderLabel {
  if (!entry.allowed) {
    return {
      tone: 'refused',
      text: 'refused',
      detail: 'This call did not go through, so it went out under nothing.',
    };
  }
  if (entry.outcome === 'input_required') {
    return {
      tone: 'asked',
      text: 'stopped to ask you',
      detail:
        'The agent was paused here and raised a request. Whatever you answered ' +
        'is on the call it made next, not on this one.',
    };
  }
  if (entry.under === 'concession') {
    return {
      tone: 'standing',
      text: 'standing grant',
      detail:
        entry.underSentence ??
        'A standing permission removed the pause. Its wording belongs to ' +
          'whoever gave it.',
    };
  }
  if (entry.under === 'approval') {
    return {
      tone: 'once',
      text: 'allowed once',
      detail: 'You answered this one, and the answer was spent on it.',
    };
  }
  return {
    tone: 'untraced',
    text: 'not traced',
    detail:
      'Allowed, and nothing to trace it to: which permission an action went ' +
      'out under is stamped on the operation it started, and this call ' +
      'started none.',
  };
}

export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 4);
}

export function actedOn(entry: {
  operation: AgentActivityOperation | null;
  operationId: string | null;
}): string | null {
  return entry.operation?.resourceName ?? null;
}

export function operationNote(entry: {
  operation: AgentActivityOperation | null;
  operationId: string | null;
}): string | null {
  if (entry.operation) {
    return `operation ${shortId(entry.operation.id)}, ${entry.operation.status.toLowerCase()}`;
  }
  if (entry.operationId) return 'started something you cannot read';
  return null;
}
