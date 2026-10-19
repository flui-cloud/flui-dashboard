import { TestBed } from '@angular/core/testing';
import { SHOW_SYSTEM_APPS_KEY } from '../../layout/components/sidebar/sidebar-nav.config';
import { SystemAppsPreference } from './system-apps-preference.service';

describe('SystemAppsPreference', () => {
  const fresh = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(SystemAppsPreference);
  };

  afterEach(() => localStorage.removeItem(SHOW_SYSTEM_APPS_KEY));

  it('leaves them out of lists and draws them on the map until someone chooses', () => {
    localStorage.removeItem(SHOW_SYSTEM_APPS_KEY);
    const pref = fresh();
    expect(pref.shown()).toBeFalse();
    expect(pref.shownOnMap()).toBeTrue();
  });

  it('lets a choice made in the sidebar hold on the map too', () => {
    localStorage.removeItem(SHOW_SYSTEM_APPS_KEY);
    const pref = fresh();
    pref.toggle();
    expect(pref.shown()).toBeTrue();
    expect(pref.shownOnMap()).toBeTrue();
    pref.toggle();
    expect(pref.shown()).toBeFalse();
    expect(pref.shownOnMap()).toBeFalse();
    expect(localStorage.getItem(SHOW_SYSTEM_APPS_KEY)).toBe('false');
  });

  it('lets hiding them on the map hold in the sidebar too', () => {
    localStorage.removeItem(SHOW_SYSTEM_APPS_KEY);
    const pref = fresh();
    pref.toggleOnMap();
    expect(pref.shownOnMap()).toBeFalse();
    expect(pref.shown()).toBeFalse();
    expect(fresh().shownOnMap()).toBeFalse();
  });

  it('reads a stored choice for both', () => {
    localStorage.setItem(SHOW_SYSTEM_APPS_KEY, 'true');
    const shown = fresh();
    expect(shown.shown()).toBeTrue();
    expect(shown.shownOnMap()).toBeTrue();
    localStorage.setItem(SHOW_SYSTEM_APPS_KEY, 'false');
    const hidden = fresh();
    expect(hidden.shown()).toBeFalse();
    expect(hidden.shownOnMap()).toBeFalse();
  });
});
