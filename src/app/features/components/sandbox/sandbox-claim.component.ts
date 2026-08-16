import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideLoaderCircle,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import {
  SandboxClaimError,
  SandboxService,
} from '../../../core/services/sandbox.service';

@Component({
  selector: 'app-sandbox-claim',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({ lucideCheck, lucideLoaderCircle, lucideTriangleAlert }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid place-items-center bg-background px-5 py-10">
      <main class="w-full max-w-md">
        @if (error(); as failure) {
          <div class="space-y-5">
            <div
              class="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400"
            >
              <ng-icon name="lucideTriangleAlert" class="h-5 w-5" />
              <h1 class="text-lg font-semibold">{{ heading(failure) }}</h1>
            </div>

            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ failure.message }}
            </p>

            <div class="flex flex-wrap gap-3">
              @if (failure.reason === 'full' || failure.reason === 'unknown') {
                <button
                  type="button"
                  (click)="start()"
                  class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Try again
                </button>
              }
              @if (failure.reason === 'limit') {
                <button
                  type="button"
                  (click)="goToDashboard()"
                  class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Go to my sandbox
                </button>
              }
              <a
                href="https://flui.cloud"
                class="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Back to flui.cloud
              </a>
            </div>
          </div>
        } @else {
          <div class="space-y-8">
            <div class="flex items-center gap-2.5 text-muted-foreground">
              <ng-icon
                name="lucideLoaderCircle"
                class="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span class="text-sm">Assigning your sandbox</span>
            </div>

            <ul class="space-y-4" aria-live="polite">
              @for (line of LINES; track line.text; let i = $index) {
                <li
                  class="flex items-start gap-3 transition-opacity duration-500"
                  [class.opacity-25]="i > step()"
                >
                  <span
                    class="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border"
                    [class]="
                      i <= step()
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    "
                  >
                    @if (i <= step()) {
                      <ng-icon name="lucideCheck" class="h-3 w-3" />
                    }
                  </span>
                  <span class="text-sm leading-relaxed">
                    <span class="font-medium">{{ line.text }}</span>
                    <span class="text-muted-foreground"> {{ line.detail }}</span>
                  </span>
                </li>
              }
            </ul>
          </div>
        }
      </main>
    </div>
  `,
})
export class SandboxClaimComponent implements OnDestroy {
  private readonly sandbox = inject(SandboxService);
  private readonly router = inject(Router);

  protected readonly LINES = [
    {
      text: 'A real cluster, shared.',
      detail: 'Not a simulation, and not yours alone — it has quotas.',
    },
    {
      text: 'Your own isolated space.',
      detail: 'No other guest can see or reach what you do in it.',
    },
    {
      text: 'Deleted after 24 hours.',
      detail: 'Completely, with no warning email and no way to extend it.',
    },
  ];

  protected readonly step = signal(-1);
  protected readonly error = signal<SandboxClaimError | null>(null);

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.start();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  protected start(): void {
    this.error.set(null);
    this.step.set(-1);
    this.clearTimers();

    // Paced on their own clock, not the request's: the tenancy is pre-built, so
    // an unthrottled claim returns before the terms can be read.
    this.LINES.forEach((_, i) => {
      this.timers.push(setTimeout(() => this.step.set(i), 350 + i * 550));
    });

    const claimed = this.sandbox.claim();
    const settled = new Promise<void>((resolve) => {
      this.timers.push(setTimeout(resolve, 350 + this.LINES.length * 550));
    });

    claimed.subscribe({
      next: () => {
        void settled.then(() => this.goToDashboard());
      },
      error: (failure: SandboxClaimError) => this.error.set(failure),
    });
  }

  protected goToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  protected heading(failure: SandboxClaimError): string {
    switch (failure.reason) {
      case 'full':
        return 'Every sandbox is busy';
      case 'closed':
        return 'The sandbox is closed right now';
      case 'limit':
        return 'You already have one open';
      case 'disabled':
        return 'No sandbox here';
      default:
        return 'That did not work';
    }
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
