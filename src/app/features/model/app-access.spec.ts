import { accessOf, allowsTab } from './app-access';

describe('app access summary', () => {
  it('reads the summary the API sent', () => {
    const access = accessOf({
      access: { tabs: ['overview', 'logs'], readOnly: true, showcase: true, dataAccess: false },
    });
    expect(access).toEqual({
      tabs: ['overview', 'logs'],
      readOnly: true,
      showcase: true,
      dataAccess: false,
    });
  });

  it('assumes data access when an older instance does not say', () => {
    expect(
      accessOf({ access: { tabs: [], readOnly: false, showcase: false } })?.dataAccess,
    ).toBeTrue();
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

  it('keeps the sections the summary never lists reachable, the API guarding their reads', () => {
    const access = accessOf({
      access: { tabs: ['overview', 'logs'], readOnly: false, showcase: false },
    });
    expect(allowsTab(access, 'diagnoses')).toBe(true);
    expect(allowsTab(access, 'debug-pods')).toBe(true);
  });

  it('does not trust the flags to be booleans', () => {
    const access = accessOf({
      access: { tabs: [], readOnly: 'yes', showcase: 0 },
    });
    expect(access).toEqual({ tabs: [], readOnly: true, showcase: false, dataAccess: true });
  });
});
