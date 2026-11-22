import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => localStorage.removeItem('flui-theme'));
  afterEach(() => {
    localStorage.removeItem('flui-theme');
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset['theme'];
  });

  it('starts light for someone who never chose', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkMode()).toBe(false);
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('stays light for someone who chose dark before the console was light only', () => {
    localStorage.setItem('flui-theme', 'dark');
    document.documentElement.classList.add('dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDarkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
