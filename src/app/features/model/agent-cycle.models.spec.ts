import {
  AgentConcession,
  AgentProposal,
  PROPOSAL_STATUS,
  ceilingSentence,
  estimateFacts,
  expiredCount,
  isProposalLive,
  offersAlways,
  splitAction,
  standingConcessions,
  waitingOn,
} from './agent-cycle.models';

const NOW = Date.parse('2026-08-24T12:00:00.000Z');

const proposal = (over: Partial<AgentProposal> = {}): AgentProposal => ({
  id: 'p-1',
  keyId: 'k-1',
  action: 'POST /infrastructure/clusters/:id/workers',
  binding: { id: 'c-1' },
  argsDigest: 'digest',
  sentence: 'add nodes to cluster c-1',
  offersAlways: true,
  status: PROPOSAL_STATUS.PENDING,
  expiresAt: '2026-08-24T12:30:00.000Z',
  createdAt: '2026-08-24T11:58:00.000Z',
  ...over,
});

const concession = (over: Partial<AgentConcession> = {}): AgentConcession => ({
  id: 'g-1',
  keyId: 'k-1',
  action: 'POST /infrastructure/clusters/:id/workers',
  binding: { id: 'c-1' },
  sentence: 'add nodes to cluster c-1',
  createdAt: '2026-08-20T09:00:00.000Z',
  ...over,
});

describe('the rule that decides whether "always" is on offer', () => {
  it('offers it when the request stated its own boundary', () => {
    expect(offersAlways(proposal({ offersAlways: true }))).toBe(true);
  });

  it('withholds it when the request could not state its boundary', () => {
    expect(offersAlways(proposal({ offersAlways: false }))).toBe(false);
  });

  it('withholds it when the field did not arrive at all', () => {
    const partial = { ...proposal() } as Partial<AgentProposal>;
    delete partial.offersAlways;
    expect(offersAlways(partial as AgentProposal)).toBe(false);
  });

  it('withholds it for anything that is not the boolean true', () => {
    for (const value of [null, undefined, 0, '', 'true', 1, {}]) {
      const odd = { ...proposal(), offersAlways: value } as unknown as AgentProposal;
      expect(offersAlways(odd))
        .withContext(`offersAlways=${JSON.stringify(value)}`)
        .toBe(false);
    }
  });

  it('never recomputes the boundary from the binding', () => {
    const bound = proposal({ offersAlways: false, binding: { id: 'c-1' } });
    expect(offersAlways(bound)).toBe(false);

    const unbound = proposal({ offersAlways: true, binding: null });
    expect(offersAlways(unbound)).toBe(true);
  });
});

describe('whether a request is still answerable', () => {
  it('is live while it is pending and its window is open', () => {
    expect(isProposalLive(proposal(), NOW)).toBe(true);
  });

  it('is not live once the estimate on it has gone stale', () => {
    expect(
      isProposalLive(proposal({ expiresAt: '2026-08-24T11:59:00.000Z' }), NOW),
    ).toBe(false);
  });

  it('is not live once it has been answered', () => {
    for (const status of [
      PROPOSAL_STATUS.APPROVED,
      PROPOSAL_STATUS.CONSUMED,
      PROPOSAL_STATUS.DENIED,
    ]) {
      expect(isProposalLive(proposal({ status }), NOW)).toBe(false);
    }
  });

  it('treats an unreadable expiry as expired rather than as forever', () => {
    expect(isProposalLive(proposal({ expiresAt: 'not a date' }), NOW)).toBe(false);
  });

  it('leaves a request with no window open', () => {
    expect(isProposalLive(proposal({ expiresAt: null }), NOW)).toBe(true);
  });
});

describe('what the two lists show', () => {
  const all = [
    proposal({ id: 'live' }),
    proposal({ id: 'stale', expiresAt: '2026-08-24T10:00:00.000Z' }),
    proposal({ id: 'denied', status: PROPOSAL_STATUS.DENIED }),
    proposal({ id: 'spent', status: PROPOSAL_STATUS.CONSUMED }),
  ];

  it('waits only on what a person can still answer', () => {
    expect(waitingOn(all, NOW).map((p) => p.id)).toEqual(['live']);
  });

  it('counts the ones whose window closed unanswered', () => {
    expect(expiredCount(all, NOW)).toBe(1);
  });

  it('lists only the grants still in force', () => {
    const rows = standingConcessions([
      concession({ id: 'standing' }),
      concession({ id: 'gone', revokedAt: '2026-08-22T09:00:00.000Z' }),
    ]);
    expect(rows.map((c) => c.id)).toEqual(['standing']);
  });
});

describe('reading an action shape', () => {
  it('splits the verb from the pattern', () => {
    expect(splitAction('POST /infrastructure/clusters/:id/workers')).toEqual({
      verb: 'POST',
      pattern: '/infrastructure/clusters/:id/workers',
    });
  });

  it('leaves a shape with no verb as a bare pattern', () => {
    expect(splitAction('/whatever')).toEqual({ verb: '', pattern: '/whatever' });
  });
});

describe('putting a price in front of the decision', () => {
  it('reads the scalar leaves of whatever the estimate route answered', () => {
    expect(
      estimateFacts({
        nodeType: 'CPU-4',
        memoryGb: 8,
        monthlyCost: '€8.49 / month',
        billable: true,
      }),
    ).toEqual([
      { label: 'nodeType', value: 'CPU-4', money: false },
      { label: 'memoryGb', value: '8', money: false },
      { label: 'monthlyCost', value: '€8.49 / month', money: true },
      { label: 'billable', value: 'yes', money: false },
    ]);
  });

  it('flattens one level so a nested price is still readable', () => {
    expect(estimateFacts({ price: { monthly: '$12.00', currency: 'USD' } })).toEqual([
      { label: 'price.monthly', value: '$12.00', money: true },
      { label: 'price.currency', value: 'USD', money: true },
    ]);
  });

  it('emphasises a figure because the value carries a currency, not because of its name', () => {
    const [bare, priced] = estimateFacts({ cost: 8.49, whatever: '€8.49' });
    expect(bare).toEqual({ label: 'cost', value: '8.49', money: false });
    expect(priced.money).toBe(true);
  });

  it('answers with nothing for a body it cannot read', () => {
    for (const body of [null, undefined, 'a string', 42, ['a', 'list']]) {
      expect(estimateFacts(body)).toEqual([]);
    }
  });

  it('caps what it will put in a card', () => {
    const wide: Record<string, string> = {};
    for (let i = 0; i < 30; i++) wide[`k${i}`] = `v${i}`;
    expect(estimateFacts(wide).length).toBe(8);
  });
});

describe('the ceiling sentence', () => {
  it('names the rank when the API reported one', () => {
    expect(ceilingSentence(true, 42)).toContain('You are an administrator');
  });

  it('counts what is held when there is no rank to name', () => {
    expect(ceilingSentence(false, 3)).toContain('You hold 3 permissions');
    expect(ceilingSentence(false, 1)).toContain('You hold 1 permission');
  });

  it('claims nothing when nothing has been read yet', () => {
    const said = ceilingSentence(false, 0);
    expect(said).not.toContain('administrator');
    expect(said).toContain('cannot reach past it');
  });
});
