import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  AgentGrantRow,
  AgentRequestRow,
  AgentsSurfaceInput,
  AgentsSurfaceRevision,
  agentConcessionEntityRef,
  agentProposalEntityRef,
  buildAgentsSurface,
  presentedContent,
} from './agents-surface';
import type { AgentConcession, AgentProposal } from '../../model/agent-cycle.models';

const PROPOSAL: AgentProposal = {
  id: 'prop-1',
  keyId: 'key-1',
  action: 'restart application',
  binding: { appId: 'app-1' },
  argsDigest: 'digest-abc',
  sentence: 'restart application app-1',
  offersAlways: true,
  consequence: 'The application restarts with zero downtime.',
  status: 'PENDING',
  createdAt: '2026-09-01T00:00:00.000Z',
};

const CONCESSION: AgentConcession = {
  id: 'conc-1',
  keyId: 'key-1',
  action: 'restart application',
  binding: { appId: 'app-1' },
  sentence: 'restart application app-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: '2026-09-01T00:00:00.000Z',
};

const REQUEST_ROW: AgentRequestRow = { proposal: PROPOSAL, agentName: 'ci-deploy-key' };
const GRANT_ROW: AgentGrantRow = { concession: CONCESSION, agentName: 'ci-deploy-key' };

function input(over: Partial<AgentsSurfaceInput> = {}): AgentsSurfaceInput {
  return {
    ceiling: 'You hold 4 permissions on this instance — the grants below choose how much of that you lend out, and they cannot reach past it.',
    waitingRows: [REQUEST_ROW],
    loadingWaiting: false,
    followedProposalId: null,
    followedAnsweredStatus: null,
    expiredCount: 0,
    grantRows: [GRANT_ROW],
    activityTotal: 12,
    activityScope: 'own',
    activityShownCount: 12,
    actorRows: [],
    revokeTarget: null,
    ...over,
  };
}

function snapshotOf(over: Partial<AgentsSurfaceInput> = {}): SurfaceSnapshot {
  return buildAgentsSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((x) => x.id === 'agents')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);
const requestRow = (s: SurfaceSnapshot, id: string) => s.scopes.find((x) => x.id === `agents:requests:${id}`)!;

describe('agents surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks', () => {
    expectValidSurface(snapshotOf());
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf());
  });

  it('bumps the revision on real change', () => {
    const tracker = new AgentsSurfaceRevision();
    const first = buildAgentsSurface(input(), {
      revision: tracker.next(presentedContent(input())),
      generatedAt: '2026-09-02T09:13:00.000Z',
    });
    const changed = input({ activityTotal: 13 });
    const second = buildAgentsSurface(changed, {
      revision: tracker.next(presentedContent(changed)),
      generatedAt: '2026-09-02T09:14:00.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('is list-shaped with no selection by default: attention names only the page', () => {
    const snapshot = snapshotOf();
    expect(snapshot.attention).toEqual([{ scopeId: 'agents', reason: 'route' }]);
    const row = requestRow(snapshot, 'prop-1');
    expect(row.entities?.[0].role).toBe('related');
  });

  it('names the route-followed proposal as primary attention, reason route', () => {
    const snapshot = snapshotOf({ followedProposalId: 'prop-1' });
    expect(snapshot.attention).toEqual([
      { scopeId: 'agents:requests:prop-1', entityRef: agentProposalEntityRef('prop-1'), reason: 'route' },
    ]);
    expect(requestRow(snapshot, 'prop-1').entities?.[0].role).toBe('primary');
  });

  it('does not invent a resolved selection: a followed id already answered names only the page', () => {
    const snapshot = snapshotOf({ followedProposalId: 'prop-1', waitingRows: [], followedAnsweredStatus: 'APPROVED' });
    expect(snapshot.attention).toEqual([{ scopeId: 'agents', reason: 'route' }]);
    expect(observation(snapshot, 'flui.agents.followed_request_status')?.presentedAs.text).toBe('APPROVED');
  });

  it('ranks the revoke overlay above a followed route selection — exercises real attention arbitration (§4.1)', () => {
    const snapshot = snapshotOf({ followedProposalId: 'prop-1', revokeTarget: CONCESSION });
    expect(snapshot.attention).toEqual([
      { scopeId: 'agents:revoke-dialog', entityRef: agentConcessionEntityRef('conc-1'), reason: 'overlay' },
    ]);
    const overlay = snapshot.scopes.find((s) => s.kind === 'overlay')!;
    expect(overlay.entities).toEqual([{ ref: agentConcessionEntityRef('conc-1'), label: CONCESSION.sentence, role: 'selected' }]);
  });

  it('presents action, binding target and agent name for a waiting request', () => {
    const row = requestRow(snapshotOf(), 'prop-1');
    const obs = (key: string) => row.observations?.find((o) => o.key === key);
    expect(obs('flui.agent_request.action_verb')?.presentedAs.text).toBe('restart');
    expect(obs('flui.agent_request.action_pattern')?.presentedAs.text).toBe('application');
    expect(obs('flui.agent_request.target')?.presentedAs.text).toBe('appId=app-1');
    expect(obs('flui.agent_request.agent_name')?.presentedAs.text).toBe('ci-deploy-key');
  });

  it('produces an empty (not missing) requests list when nothing is waiting', () => {
    const snapshot = snapshotOf({ waitingRows: [] });
    const list = snapshot.scopes.find((s) => s.id === 'agents:requests')!;
    expect(list.state).toEqual({ loading: false, empty: true });
  });

  it('never invents a grants or actors list scope when there is nothing to show', () => {
    const snapshot = snapshotOf({ grantRows: [], actorRows: [] });
    expect(snapshot.scopes.some((s) => s.id === 'agents:grants')).toBe(false);
    expect(snapshot.scopes.some((s) => s.id === 'agents:actors')).toBe(false);
  });

  it('redacts: no tool-call args, no refusal message text, ever reaches the snapshot (never read at all)', () => {
    const json = JSON.stringify(snapshotOf());
    expect(json).not.toContain('args');
    expect(json).not.toContain('argsDigest');
    expect(json).not.toContain('digest-abc');
  });

  it('redacts: no minted API key material can appear — the producer never reads the connect-agent panel state, structurally', () => {
    // This is a shape assertion, not a runtime one: AgentsSurfaceInput has no field that
    // could carry CreateApiKeyResultDto.key, so there is no path for it to leak even if a
    // future edit to agents.component.ts made the key available on the component.
    const fields = Object.keys(input());
    expect(fields).not.toContain('apiKey');
    expect(fields).not.toContain('mintedKey');
  });
});
