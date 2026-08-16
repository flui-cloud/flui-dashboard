import { matchesSelector } from './iam.mappers';
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
