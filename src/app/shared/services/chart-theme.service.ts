import { Injectable, signal, computed } from '@angular/core';
import { ChartTheme, ChartColorScheme, DEFAULT_CHART_COLORS } from '../components/charts/chart.models';

/**
 * Chart Theme Service
 * Manages global theme settings for all chart components
 * Automatically detects and responds to system theme changes
 */
@Injectable({
  providedIn: 'root'
})
export class ChartThemeService {
  private readonly _theme = signal<ChartTheme | 'auto'>('auto');
  private readonly _systemTheme = signal<ChartTheme>(this.detectSystemTheme());

  /** Current active theme (resolves 'auto' to actual theme) */
  readonly currentTheme = computed<ChartTheme>(() => {
    const theme = this._theme();
    return theme === 'auto' ? this._systemTheme() : theme;
  });

  /** Current color scheme */
  readonly colorScheme = computed<ChartColorScheme>(() => DEFAULT_CHART_COLORS);

  /** Whether dark mode is active */
  readonly isDarkMode = computed(() => this.currentTheme() === 'dark');

  constructor() {
    // Listen for system theme changes
    if (typeof window !== 'undefined' && globalThis.window.matchMedia) {
      const darkModeQuery = globalThis.window.matchMedia('(prefers-color-scheme: dark)');

      // Modern browsers
      if (darkModeQuery.addEventListener) {
        darkModeQuery.addEventListener('change', (e) => {
          this._systemTheme.set(e.matches ? 'dark' : 'light');
        });
      } else {
        // Legacy browsers
        darkModeQuery.addListener((e) => {
          this._systemTheme.set(e.matches ? 'dark' : 'light');
        });
      }
    }
  }

  /**
   * Set theme preference
   * @param theme 'light', 'dark', or 'auto' to follow system
   */
  setTheme(theme: ChartTheme | 'auto'): void {
    this._theme.set(theme);
  }

  /**
   * Get theme preference
   */
  getTheme(): ChartTheme | 'auto' {
    return this._theme();
  }

  /**
   * Detect current system theme
   */
  private detectSystemTheme(): ChartTheme {
    if (typeof window !== 'undefined' && globalThis.window.matchMedia) {
      return globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Get color for specific severity
   */
  getColor(severity: 'success' | 'warning' | 'danger' | 'info' | 'neutral', index: number = 0): string {
    return this.colorScheme()[severity][index];
  }

  /**
   * Get gradient colors for specific severity
   */
  getGradient(severity: 'success' | 'warning' | 'danger' | 'info'): [string, string] {
    return this.colorScheme().gradient?.[severity] || [
      this.getColor(severity, 0),
      this.getColor(severity, 1)
    ];
  }
}
