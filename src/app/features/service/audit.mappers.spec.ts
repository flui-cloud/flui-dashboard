import { toAuditEvent, toAuditParams } from './audit.mappers';

describe('toAuditParams', () => {
  const now = Date.parse('2026-09-28T12:00:00.000Z');

  it('sends nothing for an empty filter', () => {
    expect(toAuditParams({}, now)).toEqual({});
  });

  it('turns every filter into its query parameter', () => {
    expect(
      toAuditParams(
        {
          email: '  bob@acme.com ',
          period: '24h',
          dataAccessOnly: true,
          refusedOnly: true,
          limit: 20,
        },
        now,
      ),
    ).toEqual({
      email: 'bob@acme.com',
      since: '2026-09-27T12:00:00.000Z',
      dataAccess: 'true',
      outcome: 'refused',
      limit: '20',
    });
  });

  it('leaves the toggles out when they are off', () => {
    const p = toAuditParams(
      { period: '7d', dataAccessOnly: false, refusedOnly: false },
      now,
    );
    expect(p).toEqual({ since: '2026-09-21T12:00:00.000Z' });
  });

  it('computes a 30-day window', () => {
    expect(toAuditParams({ period: '30d' }, now)['since']).toBe(
      '2026-08-29T12:00:00.000Z',
    );
  });
});

describe('toAuditEvent', () => {
  const base = {
    id: 'e1',
    at: '2026-09-28T10:00:00.000Z',
    userId: null,
    email: null,
    actorKind: null,
    actorKeyId: null,
    action: 'ssh certificate issued',
    target: null,
    status: null,
    outcome: 'ok',
    permission: null,
    dataAccess: false,
  };

  it('treats an actor without kind or email as the platform', () => {
    expect(toAuditEvent(base).actorKind).toBe('system');
  });

  it('keeps a known actor kind and outcome', () => {
    const e = toAuditEvent({
      ...base,
      email: 'bot@acme.com',
      actorKind: 'agent',
      outcome: 'refused',
      dataAccess: true,
    });
    expect(e.actorKind).toBe('agent');
    expect(e.outcome).toBe('refused');
    expect(e.dataAccess).toBeTrue();
  });
});
