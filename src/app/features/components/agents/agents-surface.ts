import type {
  AttentionTarget,
  EntityReference,
  Observation,
  ObservationSource,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';

import type { AgentConcession, AgentProposal } from '../../model/agent-cycle.models';
import { splitAction } from '../../model/agent-cycle.models';
import type { AgentIdentityActivity, ActivityScope } from '../../model/agent-activity.models';

const SURFACE_APP_ID = 'flui-dashboard';
const SURFACE_NAMESPACE = 'flui';

const PAGE_ID = 'agents';
const REQUESTS_LIST_ID = 'agents:requests';
const GRANTS_LIST_ID = 'agents:grants';
const ACTORS_LIST_ID = 'agents:actors';
const OVERLAY_ID = 'agents:revoke-dialog';
const MAX_ROWS = 50;

export function agentProposalEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://agent-proposal/${id}`;
}
export function agentConcessionEntityRef(id: string): string {
  return `${SURFACE_NAMESPACE}://agent-concession/${id}`;
}
export function agentActorEntityRef(actorRef: string): string {
  return `${SURFACE_NAMESPACE}://agent-actor/${actorRef}`;
}

export interface AgentRequestRow {
  proposal: AgentProposal;
  agentName: string | null;
}

export interface AgentGrantRow {
  concession: AgentConcession;
  agentName: string | null;
}

export interface AgentActorRow {
  identity: AgentIdentityActivity;
  name: string | null;
}

/**
 * What is deliberately never read here, and why:
 *
 * - `AgentActivityEntry.args` / `.error` — the raw tool-call arguments and the raw
 *   refusal message a person can reveal with "Show the message it was refused with".
 *   Same class of exclusion as `reconciliationError` in application-surface.ts: free
 *   text from a call the producer did not curate.
 * - the per-call activity rows themselves (up to 50) — a per-actor aggregate
 *   (`AgentActorRow`) carries the grounding value ("what has this key done") at a
 *   fraction of the size; the full log is a resourceRef case, not a today case (§9).
 * - anything from the "Connect an agent" panel — most importantly the freshly minted
 *   API key it shows once. `CreateApiKeyResultDto.key` is credential-classified and
 *   conditionally masked server-side; this producer does not read that component's
 *   state at all, so there is no path for the raw key to reach a snapshot even at the
 *   instant it is on screen.
 * - `AgentProposal.binding` values are folded into one joined text observation
 *   (matching `agent-concessions-table.component.ts`'s own `scopeOf()`), rather than one
 *   observation key per binding label — binding keys are action-parameter names, not a
 *   fixed vocabulary, and §6.1 wants observation keys namespaced from a known set.
 */
export interface AgentsSurfaceInput {
  ceiling: string;
  waitingRows: AgentRequestRow[];
  loadingWaiting: boolean;
  /** The proposal named by the route (`/agents/requests/:proposalId`), or null on the
   * plain list routes. */
  followedProposalId: string | null;
  /** Set only when a followed proposal exists but has already left the waiting set —
   * matches `answered()` in agents.component.ts. */
  followedAnsweredStatus: string | null;
  expiredCount: number;
  grantRows: AgentGrantRow[];
  activityTotal: number;
  activityScope: ActivityScope;
  activityShownCount: number;
  actorRows: AgentActorRow[];
  /** The concession the revoke-permission overlay is open on, or null when it is closed. */
  revokeTarget: AgentConcession | null;
}

export interface AgentsSurfaceContext {
  revision: number;
  generatedAt: string;
  appVersion?: string;
}

function textObservation(key: string, value: string | undefined | null, source: ObservationSource): Observation | null {
  return value ? { key, presentedAs: { text: value }, source } : null;
}

function valueObservation(key: string, value: number | boolean, source: ObservationSource): Observation {
  return { key, presentedAs: { value }, source };
}

function bindingSummary(binding: Record<string, string> | null | undefined): string | null {
  const entries = Object.entries(binding ?? {});
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(' · ') : null;
}

function pageObservations(input: AgentsSurfaceInput): Observation[] {
  return [
    textObservation('flui.agents.ceiling', input.ceiling, 'derived'),
    valueObservation('flui.agents.waiting_count', input.waitingRows.length, 'derived'),
    input.expiredCount > 0 ? valueObservation('flui.agents.expired_count', input.expiredCount, 'derived') : null,
    valueObservation('flui.agents.granted_count', input.grantRows.length, 'derived'),
    valueObservation('flui.agents.activity_total', input.activityTotal, 'api'),
    textObservation('flui.agents.activity_scope', input.activityScope, 'api'),
    input.followedAnsweredStatus
      ? textObservation('flui.agents.followed_request_status', input.followedAnsweredStatus, 'api')
      : null,
  ].filter((observation): observation is Observation => observation !== null);
}

function requestRowScope(row: AgentRequestRow, isFollowed: boolean): SemanticScopeSnapshot {
  const { proposal } = row;
  const { verb, pattern } = splitAction(proposal.action);
  const entity: EntityReference = {
    ref: agentProposalEntityRef(proposal.id),
    label: proposal.sentence,
    role: isFollowed ? 'primary' : 'related',
  };
  return {
    id: `${REQUESTS_LIST_ID}:${proposal.id}`,
    parentId: REQUESTS_LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: [
      textObservation('flui.agent_request.action_verb', verb, 'api'),
      textObservation('flui.agent_request.action_pattern', pattern, 'api'),
      valueObservation('flui.agent_request.offers_always', proposal.offersAlways, 'api'),
      textObservation('flui.agent_request.agent_name', row.agentName, 'api'),
      textObservation('flui.agent_request.target', bindingSummary(proposal.binding), 'ui'),
    ].filter((observation): observation is Observation => observation !== null),
  };
}

function grantRowScope(row: AgentGrantRow): SemanticScopeSnapshot {
  const { concession } = row;
  const entity: EntityReference = {
    ref: agentConcessionEntityRef(concession.id),
    label: concession.sentence,
    role: 'related',
  };
  return {
    id: `${GRANTS_LIST_ID}:${concession.id}`,
    parentId: GRANTS_LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: [
      textObservation('flui.agent_grant.scope', bindingSummary(concession.binding) ?? splitAction(concession.action).pattern, 'derived'),
      textObservation('flui.agent_grant.agent_name', row.agentName, 'api'),
      textObservation('flui.agent_grant.created_at', concession.createdAt, 'api'),
      textObservation('flui.agent_grant.last_used_at', concession.lastUsedAt, 'api'),
    ].filter((observation): observation is Observation => observation !== null),
  };
}

function actorRowScope(row: AgentActorRow, actorRef: string): SemanticScopeSnapshot {
  const { identity } = row;
  const entity: EntityReference = {
    ref: agentActorEntityRef(actorRef),
    label: row.name ?? undefined,
    role: 'related',
  };
  return {
    id: `${ACTORS_LIST_ID}:${actorRef}`,
    parentId: ACTORS_LIST_ID,
    kind: 'region',
    entities: [entity],
    observations: [
      valueObservation('flui.agent_actor.calls', identity.calls, 'api'),
      valueObservation('flui.agent_actor.refused', identity.refused, 'api'),
      valueObservation('flui.agent_actor.revoked', identity.actorKeyRevoked === true, 'api'),
      textObservation('flui.agent_actor.last_activity_at', identity.lastActivityAt, 'api'),
    ].filter((observation): observation is Observation => observation !== null),
  };
}

/** Same shape `actorRef()` in agent-activity.models.ts computes — kept local so this
 * producer stays a pure function of the input it is given (§3.4), not a second caller
 * of app helpers with its own drift risk. */
function actorRefOf(identity: AgentIdentityActivity): string {
  return identity.actorKeyId ? `key:${identity.actorKeyId}` : `account:${identity.userId}`;
}

export interface PresentedContent {
  scopes: SemanticScopeSnapshot[];
  attention: AttentionTarget[];
}

/**
 * Three independent list sections, no single primary entity — except two competing,
 * mutually exclusive attention claims the spec anticipates but this repo had not yet
 * exercised (§4.1): a proposal named by the route, and the revoke-permission overlay.
 * Default ranking (§4.1 SHOULD): overlay outranks route. Neither is invented — when
 * neither is present, attention names only the page (pattern 2, as every list here is
 * a "click navigates/acts", never a "click selects" list).
 */
export function presentedContent(input: AgentsSurfaceInput): PresentedContent {
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Agents',
    observations: pageObservations(input),
  };

  const requestRows = input.waitingRows.slice(0, MAX_ROWS);
  const requestsListScope: SemanticScopeSnapshot = {
    id: REQUESTS_LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Waiting on you',
    completeness: { shown: requestRows.length, total: input.waitingRows.length },
    state: { loading: input.loadingWaiting, empty: requestRows.length === 0 },
  };

  const grantRows = input.grantRows.slice(0, MAX_ROWS);
  const grantsListScope: SemanticScopeSnapshot = {
    id: GRANTS_LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Granted permanently',
    completeness: { shown: grantRows.length, total: input.grantRows.length },
    state: { empty: grantRows.length === 0 },
  };

  const actorRows = input.actorRows.slice(0, MAX_ROWS);
  const actorsListScope: SemanticScopeSnapshot = {
    id: ACTORS_LIST_ID,
    parentId: PAGE_ID,
    kind: 'list',
    label: 'Acting identities',
    completeness: { shown: actorRows.length, total: input.actorRows.length },
    state: { empty: actorRows.length === 0 },
  };

  const scopes: SemanticScopeSnapshot[] = [
    pageScope,
    requestsListScope,
    ...requestRows.map((row) => requestRowScope(row, row.proposal.id === input.followedProposalId)),
    ...(grantRows.length ? [grantsListScope, ...grantRows.map(grantRowScope)] : []),
    ...(actorRows.length ? [actorsListScope, ...actorRows.map((row) => actorRowScope(row, actorRefOf(row.identity)))] : []),
  ];

  let attention: AttentionTarget[];
  if (input.revokeTarget) {
    const ref = agentConcessionEntityRef(input.revokeTarget.id);
    scopes.push({
      id: OVERLAY_ID,
      parentId: PAGE_ID,
      kind: 'overlay',
      label: 'Take this permission back',
      entities: [{ ref, label: input.revokeTarget.sentence, role: 'selected' }],
    });
    attention = [{ scopeId: OVERLAY_ID, entityRef: ref, reason: 'overlay' }];
  } else if (input.followedProposalId && requestRows.some((r) => r.proposal.id === input.followedProposalId)) {
    attention = [
      {
        scopeId: `${REQUESTS_LIST_ID}:${input.followedProposalId}`,
        entityRef: agentProposalEntityRef(input.followedProposalId),
        reason: 'route',
      },
    ];
  } else {
    attention = [{ scopeId: PAGE_ID, reason: 'route' }];
  }

  return { scopes, attention };
}

export function buildAgentsSurface(input: AgentsSurfaceInput, context: AgentsSurfaceContext): SurfaceSnapshot {
  const content = presentedContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID, ...(context.appVersion ? { version: context.appVersion } : {}) },
    surface: {
      id: PAGE_ID,
      route: 'agents',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}

export class AgentsSurfaceRevision {
  private counter = 0;
  private lastHash = '';

  next(presented: PresentedContent): number {
    const hash = JSON.stringify(presented);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.counter += 1;
    }
    return this.counter;
  }
}
