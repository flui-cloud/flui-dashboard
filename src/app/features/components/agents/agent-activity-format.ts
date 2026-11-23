import { StatusTone } from '../../../ui/primitives/status';
import {
  ActorKind,
  AgentIdentityActivity,
  UnderTone,
  actorRef,
  isAssistantActor,
} from '../../model/agent-activity.models';
import { formatTimeSince } from '../../model/dns.models';
import { AgentActorRow } from './agent-actors-table';

const KIND_LABELS: Record<ActorKind, string> = {
  agent: 'Agent',
  key: 'API key',
  user: 'Person',
  unknown: 'Unknown',
};

const UNDER_TONES: Record<UnderTone, StatusTone> = {
  refused: 'error',
  asked: 'warning',
  standing: 'success',
  once: 'success',
  untraced: 'neutral',
};

export function underTone(tone: UnderTone): StatusTone {
  return UNDER_TONES[tone] ?? 'neutral';
}

export function actorRow(identity: AgentIdentityActivity, name: string | null): AgentActorRow {
  const calls = identity.calls === 1 ? '1 call' : `${identity.calls} calls`;
  const refused = identity.refused ? `, ${identity.refused} refused` : '';
  const revoked = identity.actorKeyRevoked === true;
  const lastRefused = identity.lastAllowed === false;
  let state = 'Active';
  if (revoked) state = 'Key revoked';
  else if (lastRefused) state = 'Last call refused';
  let tone: StatusTone = 'success';
  if (revoked) tone = 'neutral';
  else if (lastRefused) tone = 'warning';
  const assistant = isAssistantActor(identity);
  let through = 'Account';
  if (assistant) through = 'In-product assistant';
  else if (identity.actorKeyId) through = 'API key';
  return {
    ref: actorRef(identity),
    name: name ?? 'An agent with no name left',
    kind: KIND_LABELS[identity.actorKind ?? 'unknown'] ?? 'Unknown',
    through,
    activity: `${calls}${refused}`,
    lastActive: formatTimeSince(identity.lastActivityAt),
    lastActiveAt: identity.lastActivityAt,
    tone,
    state,
  };
}
