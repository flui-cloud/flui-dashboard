import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucidePause, lucidePlay } from '@ng-icons/lucide';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { Level } from '../../model/installation-now.models';
import { InstallationNowService } from '../../service/installation-now.service';
import {
  InstallationNowSurfaceInput,
  InstallationNowSurfaceRevision,
  buildInstallationNowSurface,
  presentedContent,
} from './installation-now-surface';
import { NowPlatformComponent } from './now-platform';
import { NowTrafficComponent } from './now-traffic';

export const NOW_REFRESH_MS = 30_000;

@Component({
  selector: 'app-installation-now',
  imports: [
    DatePipe,
    FlAlert,
    FlButton,
    FlIcon,
    FlLoadingState,
    FlMetric,
    FlMetricStrip,
    FlPageHeader,
    FlPanel,
    FlStatus,
    FlUsageBar,
    NowPlatformComponent,
    NowTrafficComponent,
  ],
  providers: [provideIcons({ lucidePause, lucidePlay })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Live">
        <span headerStatus class="contents">
          @if (data()?.alerts?.firing === 0) {
            <fl-status tone="success" label="No alert firing" data-testid="now-alerts" />
          }
        </span>
        <span headerMeta>
          What runs out first under a crowd. Thresholds come from this installation's settings.
        </span>
        @if (data(); as d) {
          <span headerMeta class="fl-mono" data-testid="now-updated">
            Updated {{ d.measuredAt | date: 'HH:mm:ss' }}
          </span>
        }
        <ng-container headerActions>
          <button flButton type="button" data-testid="now-pause" (click)="togglePause()">
            <fl-icon [name]="paused() ? 'lucidePlay' : 'lucidePause'" />
            {{ paused() ? 'Resume' : 'Pause' }}
          </button>
        </ng-container>
      </fl-page-header>

      @if (service.refused()) {
        <fl-alert tone="info" title="Live figures unavailable" data-testid="now-refused">
          {{ service.refusalMessage() }}
        </fl-alert>
      }

      @if (service.error(); as message) {
        <fl-alert tone="error" title="Could not refresh" data-testid="now-error">
          {{ message }}
        </fl-alert>
      }

      @if (data(); as d) {
        @if (d.alerts.firing > 0) {
          <fl-alert
            data-testid="now-alerts"
            [tone]="d.alerts.critical > 0 ? 'error' : 'warning'"
            [title]="d.alerts.firing + ' firing · ' + d.alerts.critical + ' critical'"
          >
            @for (name of d.alerts.names; track name) {
              <span class="fl-mono" data-testid="now-alert-name">{{ name }}</span>
              @if (!$last) {
                <span>, </span>
              }
            }
          </fl-alert>
        }

        @if (d.sandbox; as s) {
          <fl-panel title="Demo" data-testid="now-demo">
            <div class="flex flex-col gap-4">
              <fl-metric-strip>
                <fl-metric
                  label="Spaces in use"
                  [value]="s.live + ' / ' + s.ceiling"
                  [tone]="spaceLevel(s.live, s.ceiling) === 'ok' ? 'default' : 'warning'"
                  data-testid="now-demo-live"
                />
                <fl-metric label="Ready" [value]="s.warm" />
                <fl-metric
                  label="Waiting"
                  [value]="s.waiting"
                  [tone]="s.waiting > 0 ? 'warning' : 'default'"
                  data-testid="now-demo-waiting"
                />
                <fl-metric
                  label="Turned away"
                  [value]="s.fullRefusals"
                  [tone]="s.fullRefusals > 0 ? 'warning' : 'default'"
                  data-testid="now-demo-turned-away"
                />
              </fl-metric-strip>
              <fl-usage-bar
                label="Demo spaces in use"
                [percent]="percentOf(s.live, s.ceiling)"
                [aside]="s.live + ' of ' + s.ceiling + ' spaces'"
                [warnAt]="80"
                [criticalAt]="100"
              />
            </div>
          </fl-panel>
        }

        <app-now-traffic [now]="d" />
        <app-now-platform [now]="d" />
      } @else if (service.loading()) {
        <fl-panel>
          <fl-loading-state [rows]="5" />
        </fl-panel>
      }
    </div>
  `,
})
export class InstallationNowComponent implements OnInit, OnDestroy {
  protected readonly service = inject(InstallationNowService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly paused = signal(false);
  protected readonly data = computed(() => (this.service.refused() ? null : this.service.now()));

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly surfaceRevision = new InstallationNowSurfaceRevision();

  readonly surface = computed(() => {
    const input: InstallationNowSurfaceInput = {
      loading: this.service.loading(),
      refused: this.service.refused(),
      hasError: !!this.service.error(),
      paused: this.paused(),
      now: this.data(),
    };
    return buildInstallationNowSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    void this.service.load();
    this.start();
  }

  ngOnDestroy(): void {
    this.stop();
    this.currentSurface.set(null);
  }

  protected togglePause(): void {
    if (this.paused()) {
      this.paused.set(false);
      void this.service.load();
      this.start();
    } else {
      this.paused.set(true);
      this.stop();
    }
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => {
      if (!this.service.refused()) void this.service.load();
    }, NOW_REFRESH_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  protected spaceLevel(live: number, ceiling: number): Level {
    if (ceiling <= 0) return 'ok';
    const share = (live / ceiling) * 100;
    if (share >= 100) return 'bad';
    return share >= 80 ? 'warn' : 'ok';
  }

  protected percentOf(part: number, whole: number): number {
    return whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
  }
}
