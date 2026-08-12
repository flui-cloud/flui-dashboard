import { Injectable, computed, inject, signal } from '@angular/core';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailOverview, MailReadiness, MailWindow } from '../../model/mail-console.models';
import { consoleError } from './mail-format';

const WINDOW_KEY = 'mail:window';

@Injectable()
export class MailOverviewStateService {
  private readonly api = inject(MailConsoleService);

  readonly window = signal<MailWindow>(readWindow());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<MailOverview | null>(null);
  readonly readiness = signal<MailReadiness | null>(null);

  readonly toFix = computed(
    () => this.readiness()?.steps.filter((s) => s.status === 'manual').length ?? 0,
  );

  readonly senders = computed(() => this.overview()?.senders ?? []);
  readonly domains = computed(() => this.overview()?.domains ?? []);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.overview(this.window()).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
    this.api.readiness().subscribe({
      next: (readiness) => this.readiness.set(readiness),
      error: () => this.readiness.set(null),
    });
  }

  setWindow(window: MailWindow): void {
    if (window === this.window()) return;
    this.window.set(window);
    try {
      localStorage.setItem(WINDOW_KEY, window);
    } catch {
      // Storage refused by the browser must not fail the render.
    }
    this.load();
  }
}

function readWindow(): MailWindow {
  try {
    const stored = localStorage.getItem(WINDOW_KEY);
    if (stored === '24h' || stored === '7d' || stored === '14d' || stored === '30d') {
      return stored;
    }
  } catch {
    // Storage refused by the browser must not fail the render.
  }
  return '14d';
}
