import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly isDarkMode = signal(false).asReadonly();

  constructor() {
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset['theme'] = 'light';
  }
}
