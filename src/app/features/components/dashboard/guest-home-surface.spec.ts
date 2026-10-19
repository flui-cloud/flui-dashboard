import {
  expectDeterministicDigest,
  expectValidSurface,
} from '../../../../testing/surface-test-utils';
import {
  GuestHomeSurfaceInput,
  buildGuestHomeSurface,
} from './guest-home-surface';

function input(
  over: Partial<GuestHomeSurfaceInput> = {},
): GuestHomeSurfaceInput {
  return {
    loading: false,
    showcase: [
      {
        id: 'app-1',
        name: 'Northwind shop',
        note: 'A shop with its database',
        hasLink: true,
      },
    ],
    hasArea: true,
    visitor: false,
    ownApps: [{ id: 'app-9', name: 'my-api', status: 'running' }],
    workloadTtlHours: 24,
    quota: { cpu: '2', memory: '4Gi', storage: '10Gi' },
    areas: [
      { key: 'backups', area: 'Backups', level: 'stand-in', why: '' },
      { key: 'mail', area: 'Mail', level: 'stand-in', why: '' },
      { key: 'access', area: 'Access', level: 'closed', why: '' },
    ],
    exploreText: 'The apps here are real and running.',
    installText: 'This demo is read-only. Install Flui on your own server.',
    installWays: [
      'Guided, with your provider API key',
      'On a server you already have',
    ],
    ...over,
  };
}

const build = (over: Partial<GuestHomeSurfaceInput> = {}) =>
  buildGuestHomeSurface(input(over), {
    revision: 1,
    generatedAt: '2026-10-19T03:00:00.000Z',
  });

const text = (snapshot: ReturnType<typeof build>, key: string) =>
  snapshot.scopes
    .flatMap((s) => s.observations ?? [])
    .find((o) => o.key === key)?.presentedAs.text;

describe('guest home surface', () => {
  it('is a valid snapshot with a deterministic digest', () => {
    expectValidSurface(build());
    expectDeterministicDigest(build());
  });

  it('says what the page offers and which sections show example data', () => {
    const snapshot = build();
    expect(text(snapshot, 'flui.guest_home.explore')).toContain(
      'real and running',
    );
    expect(text(snapshot, 'flui.guest_home.install')).toContain('Install Flui');
    expect(text(snapshot, 'flui.guest_home.example_data_sections')).toBe(
      'Backups, Mail',
    );
    expect(text(snapshot, 'flui.guest_home.closed_sections')).toBe('Access');
  });

  it('names the showcase and the guest’s own applications as entities', () => {
    const refs = build()
      .scopes.flatMap((s) => s.entities ?? [])
      .map((e) => e.ref);
    expect(refs).toEqual([
      'flui://application/app-1',
      'flui://application/app-9',
    ]);
  });

  it('claims no lists while loading and no space before the first deploy', () => {
    expect(build({ loading: true }).scopes).toHaveSize(1);
    expect(
      build({ hasArea: false }).scopes.some(
        (s) => s.id === 'guest-home:your-space',
      ),
    ).toBe(false);
  });
});
