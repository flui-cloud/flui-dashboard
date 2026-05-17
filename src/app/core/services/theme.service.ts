import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'flui-theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly darkMode = signal<boolean>(this.loadFromStorage());

  isDarkMode = this.darkMode.asReadonly();

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }

  setDarkMode(isDark: boolean) {
    this.darkMode.set(isDark);
  }

  toggleDarkMode() {
    this.darkMode.update(dark => !dark);
  }

  private loadFromStorage(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored === 'dark';
    return true;
  }
}
