import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip, MetricTone } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailVolumeChartComponent } from './mail-volume-chart.component';
import { MailOverviewDomains, MailOverviewSenders } from './mail-overview-panels';
import { MailOverviewStateService } from './mail-overview-state.service';
import {
  KPI_LABEL,
  MAIL_WINDOWS,
  MailKpi,
  MailWindow,
  formatCount,
  formatDelta,
  formatRate,
} from '../../model/mail-console.models';
import { whenLabel } from './mail-format';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  MailOverviewSurfaceInput,
  MailOverviewSurfaceRevision,
  buildMailOverviewSurface,
  presentedContent,
} from './mail-overview-surface';

@Component({
  selector: 'app-mail-overview',
  imports: [
    FormsModule,
    FlAlert,
    FlMetricStrip,
    FlMetric,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlIcon,
    MailSectionNavComponent,
    MailVolumeChartComponent,
    MailOverviewDomains,
    MailOverviewSenders,
  ],
  providers: [MailOverviewStateService, provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-mail-section-nav [toFix]="s.toFix()">
        <ng-container headerActions>
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Time window"
              [ngModel]="s.window()"
              (ngModelChange)="onWindow($event)"
            >
              @for (w of windows; track w.value) {
                <option [value]="w.value">{{ w.label }}</option>
              }
            </select>
          </span>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="s.loading()"
            (click)="s.load()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-mail-section-nav>

      @if (s.loading() && !s.overview()) {
        <fl-panel>
          <fl-loading-state [rows]="6" />
        </fl-panel>
      } @else if (s.error()) {
        <fl-alert tone="error" title="Could not load mail">{{ s.error() }}</fl-alert>
      } @else if (s.overview()) {
        @let o = s.overview()!;
        @if (o.incident; as incident) {
          <fl-alert tone="error" [title]="incidentTitle(incident.title, incident.since)">
            <span class="fl-mono">{{ incident.detail }}</span>
          </fl-alert>
        }

        @if (o.limitation) {
          <fl-alert tone="info" title="Limited reporting">{{ o.limitation }}</fl-alert>
        }

        <fl-metric-strip>
          @for (k of o.kpis; track k.id) {
            <fl-metric
              [label]="label(k)"
              [value]="value(k)"
              [caption]="caption(k)"
              [tone]="tone(k)"
            />
          }
        </fl-metric-strip>

        <fl-panel title="Volume by outcome">
          <app-mail-volume-chart [points]="o.volume" [bucket]="o.bucket" />
        </fl-panel>

        <div class="fl-grid-2">
          <app-mail-overview-domains [domains]="o.domains" [unregistered]="o.unregisteredDomains" />
          <app-mail-overview-senders [senders]="o.senders" />
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

  protected incidentTitle(title: string, since: string | null): string {
    return since ? `${title}, since ${whenLabel(since)}` : title;
  }

  protected label(k: MailKpi): string {
    return KPI_LABEL[k.id];
  }

  protected value(k: MailKpi): string {
    return k.rate === null ? formatCount(k.count) : formatRate(k.rate);
  }

  protected caption(k: MailKpi): string | undefined {
    const parts = [
      formatDelta(k),
      k.rate === null ? null : `${formatCount(k.count)} messages`,
    ].filter((p): p is string => !!p);
    return parts.length ? parts.join(' · ') : undefined;
  }

  protected tone(k: MailKpi): MetricTone {
    return k.tone === 'neutral' ? 'default' : 'warning';
  }
}
