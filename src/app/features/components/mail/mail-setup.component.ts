import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideExternalLink,
  lucideRotateCcw,
  lucideTriangleAlert,
  lucideWrench,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailTestSendComponent } from './mail-test-send.component';
import { MailConsoleService } from '../../service/mail-console.service';
import {
  MailReadiness,
  MailReadinessStep,
  READINESS_STEP_LABEL,
} from '../../model/mail-console.models';
import { consoleError } from './mail-format';

@Component({
  selector: 'app-mail-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NgIcon, MailSectionNavComponent, MailTestSendComponent],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideExternalLink,
      lucideRotateCcw,
      lucideTriangleAlert,
      lucideWrench,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <app-mail-section-nav [toFix]="toFix()">
        <button
          slot="actions"
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <ng-icon
            name="lucideRotateCcw"
            class="h-3.5 w-3.5"
            [class.animate-spin]="loading()"
          />
          Re-check
        </button>
      </app-mail-section-nav>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          [(ngModel)]="domain"
          (keydown.enter)="load()"
          placeholder="Check a specific domain (optional)"
          class="h-9 w-72 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        />
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-60"
        >
          Check
        </button>
        <p class="text-xs text-muted-foreground">
          With no domain, this answers only whether the connected key covers Transactional Email at
          all — which is the first thing that goes wrong.
        </p>
      </div>

      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex items-start gap-3">
                <div class="skeleton mt-0.5 h-5 w-5 rounded-full"></div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="skeleton h-4 w-40"></div>
                    <div class="skeleton h-3 w-20"></div>
                  </div>
                  <div class="skeleton mt-2 h-3 w-3/4"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      } @else if (readiness()) {
        @let r = readiness()!;
        @if (r.ready) {
          <div
            class="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <ng-icon name="lucideCircleCheck" class="h-4 w-4 shrink-0" />
            Ready to send{{ domain.trim() ? ' from ' + domain.trim() : '' }}.
          </div>
        }

        <div class="space-y-2">
          @for (step of r.steps; track step.id) {
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex items-start gap-3">
                <span
                  class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  [class]="badgeClass(step)"
                  >{{ badgeGlyph(step) }}</span
                >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium text-foreground">{{ label(step) }}</span>
                    <span class="text-xs text-muted-foreground">{{ statusText(step) }}</span>
                  </div>
                  @if (step.action) {
                    <p class="mt-1 text-sm text-muted-foreground">{{ step.action }}</p>
                  }
                  @if (step.consoleUrl) {
                    <a
                      [href]="step.consoleUrl"
                      target="_blank"
                      rel="noopener"
                      class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open the provider console
                      <ng-icon name="lucideExternalLink" class="h-3 w-3" />
                    </a>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        @if (r.ready && domain.trim()) {
          <div class="mt-4 rounded-lg border border-border bg-card p-4">
            <h2 class="text-sm font-medium text-foreground">Prove it end to end</h2>
            <app-mail-test-send [domain]="domain.trim()" />
          </div>
        }

        <p class="mt-4 text-xs text-muted-foreground">
          Adding a sending domain and publishing its records happens on
          <a routerLink="/management/mail/domains" class="text-primary hover:underline">Domains</a>.
        </p>
      }
    </div>
  `,
})
export class MailSetupComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  protected domain = '';
  protected readonly readiness = signal<MailReadiness | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly toFix = computed(
    () => this.readiness()?.steps.filter((s) => s.status === 'manual').length ?? 0,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.readiness(this.domain.trim() || undefined).subscribe({
      next: (readiness) => {
        this.readiness.set(readiness);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected label(step: MailReadinessStep): string {
    return READINESS_STEP_LABEL[step.id] ?? step.id;
  }

  protected statusText(step: MailReadinessStep): string {
    switch (step.status) {
      case 'satisfied':
        return 'done';
      case 'pending':
        return 'the provider is still checking';
      case 'automatable':
        return 'Flui can do this';
      default:
        return 'needs you';
    }
  }

  protected badgeGlyph(step: MailReadinessStep): string {
    if (step.status === 'satisfied') return '✓';
    return step.status === 'manual' ? '!' : '…';
  }

  protected badgeClass(step: MailReadinessStep): string {
    switch (step.status) {
      case 'satisfied':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400';
      case 'manual':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }
}
