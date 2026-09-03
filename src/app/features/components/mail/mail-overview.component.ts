import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideRotateCcw,
  lucideEyeOff,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailProofPillComponent } from './mail-proof-pill.component';
import { MailVolumeChartComponent } from './mail-volume-chart.component';
import { MailOverviewStateService } from './mail-overview-state.service';
import {
  KPI_LABEL,
  MAIL_WINDOWS,
  MailKpi,
  MailSenderSummary,
  MailWindow,
  SENDER_STATUS_LABEL,
  formatCount,
  formatDelta,
  formatRate,
} from '../../model/mail-console.models';
import { shortWhen, whenLabel } from './mail-format';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailOverviewSurfaceInput,
  MailOverviewSurfaceRevision,
  buildMailOverviewSurface,
  presentedContent,
} from './mail-overview-surface';

@Component({
  selector: 'app-mail-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    NgIcon,
    MailSectionNavComponent,
    MailProofPillComponent,
    MailVolumeChartComponent,
  ],
  providers: [
    MailOverviewStateService,
    provideIcons({ lucideCircleCheck, lucideEyeOff, lucideRotateCcw, lucideTriangleAlert }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <app-mail-section-nav [toFix]="s.toFix()">
        <div slot="actions" class="flex items-center gap-2">
          <select
            [ngModel]="s.window()"
            (ngModelChange)="onWindow($event)"
            class="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            @for (w of windows; track w.value) {
              <option [value]="w.value">{{ w.label }}</option>
            }
          </select>
          <button
            type="button"
            (click)="s.load()"
            [disabled]="s.loading()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            <ng-icon
              name="lucideRotateCcw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="s.loading()"
            />
            Refresh
          </button>
        </div>
      </app-mail-section-nav>

      @if (s.loading() && !s.overview()) {
        <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="skeleton h-3 w-16"></div>
              <div class="skeleton mt-2 h-7 w-24"></div>
              <div class="skeleton mt-2 h-3 w-20"></div>
            </div>
          }
        </div>

        <div class="mb-5 rounded-lg border border-border bg-card p-4">
          <div class="skeleton h-4 w-36"></div>
          <div class="skeleton mt-3 h-56 w-full"></div>
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="skeleton h-4 w-20"></div>
            <div class="mt-3 space-y-3">
              @for (i of [1, 2]; track i) {
                <div class="flex items-center gap-2">
                  <div class="skeleton h-4 flex-1"></div>
                  <div class="skeleton h-5 w-12"></div>
                  <div class="skeleton h-5 w-14"></div>
                  <div class="skeleton h-5 w-16"></div>
                </div>
              }
            </div>
          </div>
          <div class="rounded-lg border border-border bg-card p-4">
            <div class="skeleton h-4 w-20"></div>
            <div class="skeleton mt-2 h-3 w-64"></div>
            <div class="mt-3 space-y-3">
              @for (i of [1, 2, 3]; track i) {
                <div class="flex items-center gap-3">
                  <div class="skeleton h-4 flex-1"></div>
                  <div class="skeleton h-4 w-12"></div>
                  <div class="skeleton h-4 w-14"></div>
                  <div class="skeleton h-5 w-20"></div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else if (s.error()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ s.error() }}</span>
        </div>
      } @else if (s.overview()) {
        @let o = s.overview()!;
        <div class="transition-opacity duration-200" [class.opacity-50]="s.loading()">
          @if (o.incident; as incident) {
            <div
              class="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/25 dark:bg-red-500/10"
            >
              <ng-icon
                name="lucideTriangleAlert"
                class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              />
              <div class="min-w-0">
                <p class="text-sm font-semibold text-red-900 dark:text-red-200">
                  {{ incident.title }}
                  @if (incident.since) {
                    <span class="font-normal">— since {{ when(incident.since) }}</span>
                  }
                </p>
                <p class="mt-1 font-mono text-xs text-red-800 dark:text-red-300">
                  {{ incident.detail }}
                </p>
              </div>
            </div>
          }

          @if (o.limitation) {
            <p
              class="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              <ng-icon name="lucideEyeOff" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{{ o.limitation }}</span>
            </p>
          }

          <div class="mb-5 grid gap-3" [class]="kpiColumns(o.kpis.length)">
            @for (k of o.kpis; track k.id) {
              <div class="rounded-lg border border-border bg-card p-4">
                <div class="text-xs text-muted-foreground">{{ label(k) }}</div>
                <div class="mt-1 flex items-baseline gap-2">
                  <span class="text-2xl font-semibold tabular-nums" [class]="tone(k)">
                    {{ value(k) }}
                  </span>
                  @if (delta(k); as d) {
                    <span class="text-xs text-muted-foreground tabular-nums">{{ d }}</span>
                  }
                </div>
                @if (k.rate !== null) {
                  <div class="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {{ count(k.count) }} messages
                  </div>
                }
              </div>
            }
          </div>

          <div class="mb-5 rounded-lg border border-border bg-card p-4">
            <h2 class="mb-1 text-sm font-medium text-foreground">Volume by outcome</h2>
            <app-mail-volume-chart [points]="o.volume" [bucket]="o.bucket" />
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section class="rounded-lg border border-border bg-card p-4">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-medium text-foreground">Domains</h2>
                <a
                  routerLink="/management/mail/domains"
                  class="text-xs text-primary hover:underline"
                  >Manage</a
                >
              </div>
              @if (!o.domains.length) {
                <p class="text-sm text-muted-foreground">
                  No sending domain registered yet.
                  <a routerLink="/management/mail/setup" class="text-primary hover:underline"
                    >Set one up</a
                  >.
                </p>
              } @else {
                <div class="space-y-2">
                  @for (d of o.domains; track d.domain) {
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{
                        d.domain
                      }}</span>
                      <app-mail-proof-pill purpose="spf" [verdict]="d.spf" />
                      <app-mail-proof-pill purpose="dkim" [verdict]="d.dkim" />
                      <app-mail-proof-pill purpose="dmarc" [verdict]="d.dmarc" />
                      @if (d.verified) {
                        <ng-icon
                          name="lucideCircleCheck"
                          class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          title="Verified by the provider"
                        />
                      } @else {
                        <span
                          class="text-[11px] text-amber-700 dark:text-amber-400"
                          title="Records may be right; the provider has not re-checked yet."
                          >unverified</span
                        >
                      }
                      <span class="w-20 text-right text-xs text-muted-foreground tabular-nums">{{
                        count(d.sent)
                      }}</span>
                    </div>
                  }
                </div>
              }

              @if (o.unregisteredDomains.length) {
                <p class="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                  Mail is going out from
                  <span class="font-medium">{{ o.unregisteredDomains.join(', ') }}</span
                  >, which is not registered here — so nothing has checked its records.
                </p>
              }
            </section>

            <section class="rounded-lg border border-border bg-card p-4">
              <h2 class="mb-1 text-sm font-medium text-foreground">Senders</h2>
              <p class="mb-3 text-xs text-muted-foreground">
                Grouped by the address mail was sent from — the one axis every provider reports.
              </p>
              @if (!o.senders.length) {
                <p class="text-sm text-muted-foreground">Nothing has sent mail in this window.</p>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-border text-left text-xs text-muted-foreground">
                        <th class="pb-2 font-medium">Sender</th>
                        <th class="pb-2 text-right font-medium">Sent</th>
                        <th class="pb-2 text-right font-medium">Delivered</th>
                        <th class="pb-2 pl-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of o.senders; track row.from) {
                        <tr class="border-b border-border/60 last:border-0">
                          <td class="py-2 pr-3">
                            <div class="truncate text-foreground">{{ name(row) }}</div>
                            @if (row.application) {
                              <div class="truncate font-mono text-[11px] text-muted-foreground">
                                {{ row.from }}
                              </div>
                            }
                            @if (row.lastError) {
                              <div class="truncate font-mono text-[11px] text-red-600 dark:text-red-400"
                                   [title]="row.lastError">
                                {{ row.lastError }}
                              </div>
                            }
                          </td>
                          <td class="py-2 text-right tabular-nums text-foreground">
                            {{ count(row.sent) }}
                          </td>
                          <td class="py-2 text-right tabular-nums text-muted-foreground">
                            {{ rate(row.deliveredRate) }}
                          </td>
                          <td class="py-2 pl-3">
                            <span
                              class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                              [class]="statusClass(row)"
                              [title]="statusHint(row)"
                            >
                              {{ statusLabel(row) }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          </div>
        </div>
      }
    </div>
  `,
})
export class MailOverviewComponent implements OnInit, OnDestroy {
  protected readonly s = inject(MailOverviewStateService);
  protected readonly windows = MAIL_WINDOWS;
  private readonly currentSurface = inject(CurrentSurfaceService);

  private readonly surfaceRevision = new MailOverviewSurfaceRevision();

  readonly surface = computed(() => {
    const input: MailOverviewSurfaceInput = {
      overview: this.s.overview(),
      window: this.s.window(),
      loading: this.s.loading(),
      hasLoadError: !!this.s.error(),
    };
    return buildMailOverviewSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    this.s.load();
  }

  protected onWindow(window: MailWindow): void {
    this.s.setWindow(window);
  }

  protected kpiColumns(count: number): string {
    if (count <= 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-2 lg:grid-cols-4';
  }

  protected label(k: MailKpi): string {
    return KPI_LABEL[k.id];
  }

  protected value(k: MailKpi): string {
    return k.rate === null ? formatCount(k.count) : formatRate(k.rate);
  }

  protected delta(k: MailKpi): string | null {
    return formatDelta(k);
  }

  protected count(n: number): string {
    return formatCount(n);
  }

  protected rate(r: number | null): string {
    return formatRate(r);
  }

  protected when(iso: string): string {
    return whenLabel(iso);
  }

  protected tone(k: MailKpi): string {
    if (k.tone === 'bad') return 'text-red-600 dark:text-red-400';
    if (k.tone === 'warn') return 'text-amber-700 dark:text-amber-400';
    return 'text-foreground';
  }

  protected name(row: MailSenderSummary): string {
    return row.application?.applicationName ?? row.from;
  }

  protected statusLabel(row: MailSenderSummary): string {
    return SENDER_STATUS_LABEL[row.status];
  }

  protected statusClass(row: MailSenderSummary): string {
    switch (row.status) {
      case 'failing':
        return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400';
      case 'degraded':
        return 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400';
      case 'silent':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  }

  protected statusHint(row: MailSenderSummary): string {
    switch (row.status) {
      case 'failing':
        return 'Sent, delivered nothing.';
      case 'degraded':
        return `${row.failed} of ${row.sent} failed.`;
      case 'silent':
        return 'Configured to send and has sent nothing — the state a provider cannot report.';
      default:
        return row.lastDeliveredAt ? `Last delivered ${shortWhen(row.lastDeliveredAt)}` : '';
    }
  }
}
