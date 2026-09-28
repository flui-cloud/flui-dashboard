import { matchesSelector, toCreateBody, toGrantRecord } from './iam.mappers';
import { AppAttributes } from '../model/iam.model';

const app = (over: Partial<AppAttributes> = {}): AppAttributes => ({
  id: 'a1',
  slug: 'shop',
  name: 'Shop',
  type: 'user',
  kind: 'APPLICATION',
  clusterId: 'c1',
  clusterName: 'control',
  provider: 'byos',
  tags: [],
  owner: 'user-a',
  ...over,
});

describe('matchesSelector', () => {
  it('matches an owner selector only against that owner’s apps', () => {
    expect(matchesSelector(app(), { owner: 'user-a' })).toBe(true);
    expect(matchesSelector(app(), { owner: 'user-b' })).toBe(false);
  });

  it('never lets an owner selector pick up an app that belongs to nobody', () => {
    expect(matchesSelector(app({ owner: null }), { owner: 'user-a' })).toBe(
      false,
    );
    expect(matchesSelector(app({ owner: undefined }), { owner: 'user-a' })).toBe(
      false,
    );
  });

  it('ignores the owner axis when the selector does not constrain it', () => {
    expect(matchesSelector(app({ owner: null }), { type: 'user' })).toBe(true);
  });

  it('still ANDs the other axes', () => {
    expect(matchesSelector(app(), { owner: 'user-a', type: 'system' })).toBe(
      false,
    );
    expect(
      matchesSelector(app({ tags: ['showcase'] }), { tags: ['showcase'] }),
    ).toBe(true);
    expect(matchesSelector(app(), { tags: ['showcase'] })).toBe(false);
  });

  it('matches an empty selector against everything', () => {
    expect(matchesSelector(app(), {})).toBe(true);
  });
});

describe('grant end on the wire', () => {
  const binding = {
    principal: { type: 'user' as const, ref: 'alice@acme.com' },
    role: 'platform_operator' as const,
    scope: { type: 'global' as const },
  };

  it('leaves expiresAt out of a standing grant', () => {
    expect('expiresAt' in toCreateBody(binding)).toBeFalse();
    expect('expiresAt' in toCreateBody(binding, null)).toBeFalse();
  });

  it('sends expiresAt as ISO 8601 when an end is chosen', () => {
    const at = new Date('2026-10-01T08:00:00.000Z');
    expect(toCreateBody(binding, at).expiresAt).toBe('2026-10-01T08:00:00.000Z');
  });

  it('reads expiresAt and grantedBy back, null when absent', () => {
    const row = {
      id: 'g1',
      principalType: 'user' as const,
      principalRef: 'alice@acme.com',
      role: 'viewer' as const,
      scopeType: 'global' as const,
      scopeRef: null,
      selector: null,
    };
    expect(toGrantRecord(row).expiresAt).toBeNull();
    expect(toGrantRecord(row).grantedBy).toBeNull();
    const rec = toGrantRecord({
      ...row,
      expiresAt: '2026-10-01T08:00:00.000Z',
      grantedBy: 'owner@acme.com',
    });
    expect(rec.expiresAt).toBe('2026-10-01T08:00:00.000Z');
    expect(rec.grantedBy).toBe('owner@acme.com');
  });
});
