import { accessOf, allowsTab } from './app-access';

describe('app access summary', () => {
  it('reads the summary the API sent', () => {
    const access = accessOf({
      access: { tabs: ['overview', 'logs'], readOnly: true, showcase: true },
    });
    expect(access).toEqual({
      tabs: ['overview', 'logs'],
      readOnly: true,
      showcase: true,
    });
  });

  it('treats a missing summary as no opinion', () => {
    expect(accessOf({})).toBeNull();
    expect(accessOf(null)).toBeNull();
    expect(accessOf(undefined)).toBeNull();
    expect(accessOf({ access: { readOnly: true } })).toBeNull();
  });

  it('shows every tab when the instance did not say', () => {
    expect(allowsTab(null, 'configuration')).toBe(true);
  });

  it('offers only the tabs the summary lists', () => {
    const access = accessOf({
      access: { tabs: ['overview', 'logs'], readOnly: true, showcase: false },
    });
    expect(allowsTab(access, 'overview')).toBe(true);
    expect(allowsTab(access, 'configuration')).toBe(false);
    expect(allowsTab(access, 'clients')).toBe(false);
  });

  it('does not trust the flags to be booleans', () => {
    const access = accessOf({
      access: { tabs: [], readOnly: 'yes', showcase: 0 },
    });
    expect(access).toEqual({ tabs: [], readOnly: true, showcase: false });
  });
});
