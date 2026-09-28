import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => localStorage.removeItem('flui-theme'));
  afterEach(() => {
    localStorage.removeItem('flui-theme');
    document.documentElement.classList.remove('dark');
  });

  it('starts light for someone who never chose', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkMode()).toBe(false);
  });

  it('keeps the choice someone made', () => {
    localStorage.setItem('flui-theme', 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkMode()).toBe(true);
  });
});
