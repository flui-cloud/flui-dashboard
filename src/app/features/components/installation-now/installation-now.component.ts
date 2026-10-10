import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucidePause, lucidePlay } from '@ng-icons/lucide';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ExplainComponent } from '../../../shared/components/explain.component';
import {
  EdgeNow,
  Level,
  NodeNow,
  cpuLevel,
  edgeErrorPercent,
  formatPercent,
  formatRate,
  isEdgeFailing,
  isLinkBusy,
  isMonthHeavy,
  isRateLimited,
  isSurge,
  memoryLevel,
  monthPaceLabel,
} from '../../model/installation-now.models';
import { formatMbitPerSecond } from '../../model/registry-storage.models';
import { InstallationNowService } from '../../service/installation-now.service';
import {
  InstallationNowSurfaceInput,
  InstallationNowSurfaceRevision,
  buildInstallationNowSurface,
  presentedContent,
} from './installation-now-surface';

export const NOW_REFRESH_MS = 30_000;

const MIB = 1024 * 1024;

@Component({
  selector: 'app-installation-now',
  standalone: true,
  imports: [DatePipe, NgIcon, ExplainComponent],
  providers: [provideIcons({ lucideInfo, lucidePause, lucidePlay })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Now</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            <app-explain label="What runs out first under a crowd" labelClass="text-sm text-muted-foreground">
              Amber means a figure is past an alert threshold; red means it needs attention now.
              The thresholds come from this installation's settings.
            </app-explain>
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (data(); as d) {
            <span class="text-xs text-muted-foreground" data-testid="now-updated">
              Updated {{ d.measuredAt | date: 'HH:mm:ss' }}
            </span>
          }
          <button
            type="button"
            data-testid="now-pause"
            (click)="togglePause()"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ng-icon [name]="paused() ? 'lucidePlay' : 'lucidePause'" class="h-3.5 w-3.5" />
            {{ paused() ? 'Resume' : 'Pause' }}
          </button>
        </div>
      </div>

      @if (service.refused()) {
        <div
          data-testid="now-refused"
          class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          <ng-icon name="lucideInfo" class="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{{ service.refusalMessage() }}</span>
        </div>
      }

      @if (service.error(); as message) {
        <div
          data-testid="now-error"
          class="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {{ message }}
        </div>
      }

      @if (data(); as d) {
        <div
          data-testid="now-alerts"
          class="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
          [class.border-green-500/30]="d.alerts.firing === 0"
          [class.bg-green-500/5]="d.alerts.firing === 0"
          [class.border-amber-500/40]="d.alerts.firing > 0 && d.alerts.critical === 0"
          [class.bg-amber-500/5]="d.alerts.firing > 0 && d.alerts.critical === 0"
          [class.border-destructive/40]="d.alerts.critical > 0"
          [class.bg-destructive/5]="d.alerts.critical > 0"
        >
          @if (d.alerts.firing === 0) {
            <span class="h-2 w-2 rounded-full bg-green-500"></span>
            <span class="font-medium text-green-700 dark:text-green-400">No alert firing</span>
          } @else {
            <span class="h-2 w-2 rounded-full" [class.bg-amber-500]="d.alerts.critical === 0" [class.bg-destructive]="d.alerts.critical > 0"></span>
            <span class="font-medium">{{ d.alerts.firing }} firing · {{ d.alerts.critical }} critical</span>
            @for (name of d.alerts.names; track name) {
              <span class="rounded-full bg-muted px-2 py-0.5 text-xs" data-testid="now-alert-name">{{ name }}</span>
            }
          }
        </div>

        @if (d.sandbox; as s) {
          <section class="card-surface p-5 space-y-3" data-testid="now-demo">
            <h2 class="text-sm font-semibold">Demo</h2>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="card-inner p-3 col-span-2 sm:col-span-1">
                <p class="text-label">Spaces in use</p>
                <p class="text-lg font-semibold" data-testid="now-demo-live">{{ s.live }} / {{ s.ceiling }}</p>
                <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full"
                    [class]="barClass(spaceLevel(s.live, s.ceiling))"
                    [style.width.%]="percentOf(s.live, s.ceiling)"
                  ></div>
                </div>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Ready</p>
                <p class="text-lg font-semibold">{{ s.warm }}</p>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Waiting</p>
                <p class="text-lg font-semibold" data-testid="now-demo-waiting" [class]="textClass(s.waiting > 0 ? 'warn' : 'ok')">{{ s.waiting }}</p>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Turned away</p>
                <p class="text-lg font-semibold" data-testid="now-demo-turned-away" [class]="textClass(s.fullRefusals > 0 ? 'warn' : 'ok')">{{ s.fullRefusals }}</p>
              </div>
            </div>
          </section>
        }

        <section class="card-surface" data-testid="now-edges">
          <h2 class="border-b border-border px-5 py-3 text-sm font-semibold">Requests at the door</h2>
          @if (d.edges.length === 0) {
            <p class="px-5 py-4 text-sm text-muted-foreground">No requests measured.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-left text-xs text-muted-foreground">
                  <tr>
                    <th class="px-5 py-2 font-medium">Cluster</th>
                    <th class="px-5 py-2 font-medium">Req/s now · before</th>
                    <th class="px-5 py-2 font-medium">Rate-limited, 10 min</th>
                    <th class="px-5 py-2 font-medium">Server errors, 10 min</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (e of d.edges; track e.clusterId) {
                    <tr [attr.data-testid]="'now-edge-' + e.clusterId">
                      <td class="px-5 py-2.5">{{ e.clusterName }}</td>
                      <td class="px-5 py-2.5">
                        <span class="font-medium">{{ rate(e.rpsNow) }}</span>
                        <span class="text-muted-foreground"> · {{ rate(e.rpsBefore) }}</span>
                        @if (surge(e)) {
                          <span class="badge ml-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400" data-testid="now-surge">Surge</span>
                        }
                      </td>
                      <td class="px-5 py-2.5" data-testid="now-edge-limited" [class]="textClass(limited(e) ? 'warn' : 'ok')">{{ e.rateLimited10m }}</td>
                      <td class="px-5 py-2.5" data-testid="now-edge-errors" [class]="textClass(failing(e) ? 'bad' : 'ok')">{{ errorPercent(e) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="card-surface" data-testid="now-nodes">
          <h2 class="border-b border-border px-5 py-3 text-sm font-semibold">Nodes</h2>
          @if (d.nodes.length === 0) {
            <p class="px-5 py-4 text-sm text-muted-foreground">No nodes measured.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-left text-xs text-muted-foreground">
                  <tr>
                    <th class="px-5 py-2 font-medium">Node</th>
                    <th class="px-5 py-2 font-medium">CPU</th>
                    <th class="px-5 py-2 font-medium">Memory</th>
                    <th class="px-5 py-2 font-medium">Link out · in</th>
                    <th class="px-5 py-2 font-medium">Month at this pace</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (n of d.nodes; track n.clusterId + n.node) {
                    <tr [attr.data-testid]="'now-node-' + n.node">
                      <td class="px-5 py-2.5">
                        <span class="font-medium">{{ n.node }}</span>
                        <span class="block text-xs text-muted-foreground">{{ n.clusterName }}</span>
                      </td>
                      <td class="px-5 py-2.5" data-testid="now-node-cpu">
                        <span [class]="textClass(cpu(n.cpuPercent))">{{ percent(n.cpuPercent) }}</span>
                        @if (n.cpuPercent !== null) {
                          <div class="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                            <div class="h-full rounded-full" [class]="barClass(cpu(n.cpuPercent))" [style.width.%]="clamp(n.cpuPercent)"></div>
                          </div>
                        }
                      </td>
                      <td class="px-5 py-2.5" data-testid="now-node-memory">
                        <span [class]="textClass(memory(n.memoryPercent))">{{ percent(n.memoryPercent) }}</span>
                        @if (n.memoryPercent !== null) {
                          <div class="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                            <div class="h-full rounded-full" [class]="barClass(memory(n.memoryPercent))" [style.width.%]="clamp(n.memoryPercent)"></div>
                          </div>
                        }
                      </td>
                      <td class="px-5 py-2.5 whitespace-nowrap" data-testid="now-node-link" [class]="textClass(linkBusy(n) ? 'warn' : 'ok')">
                        {{ rate(n.mbpsOut) }} · {{ rate(n.mbpsIn) }} Mbit/s
                      </td>
                      <td class="px-5 py-2.5 whitespace-nowrap" data-testid="now-node-month" [class]="n.includedTb === null ? 'text-muted-foreground' : textClass(monthHeavy(n) ? 'warn' : 'ok')">
                        {{ month(n) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="card-surface" data-testid="now-platform">
          <h2 class="border-b border-border px-5 py-3 text-sm font-semibold">Platform components</h2>
          @if (d.platform.length === 0) {
            <p class="px-5 py-4 text-sm text-muted-foreground">No components measured.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-left text-xs text-muted-foreground">
                  <tr>
                    <th class="px-5 py-2 font-medium">Component</th>
                    <th class="px-5 py-2 font-medium">CPU</th>
                    <th class="px-5 py-2 font-medium">Memory</th>
                    <th class="px-5 py-2 font-medium">Restarts, last hour</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (c of d.platform; track c.name) {
                    <tr [attr.data-testid]="'now-platform-' + c.name">
                      <td class="px-5 py-2.5">{{ c.name }}</td>
                      <td class="px-5 py-2.5" [class]="textClass(cpu(c.cpuPercent))">{{ percent(c.cpuPercent) }}</td>
                      <td class="px-5 py-2.5" data-testid="now-platform-memory" [class]="textClass(memory(c.memoryPercent))">{{ percent(c.memoryPercent) }}</td>
                      <td class="px-5 py-2.5" data-testid="now-platform-restarts" [class]="textClass(c.restartsLastHour > 0 ? 'warn' : 'ok')">{{ c.restartsLastHour }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        @if (d.registry; as r) {
          <section class="card-surface p-5 space-y-3" data-testid="now-registry">
            <h2 class="text-sm font-semibold">Image registry, last hour</h2>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="card-inner p-3">
                <p class="text-label">Pulls</p>
                <p class="text-lg font-semibold">{{ r.requests.pulls }}</p>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Pushes</p>
                <p class="text-lg font-semibold">{{ r.requests.pushes }}</p>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Pulled out</p>
                <p class="text-lg font-semibold" data-testid="now-registry-out">{{ mib(r.bytesOut) }}</p>
              </div>
              <div class="card-inner p-3">
                <p class="text-label">Peak out</p>
                <p class="text-lg font-semibold" data-testid="now-registry-peak">{{ mbit(r.peakBytesPerSecondOut) }}</p>
              </div>
            </div>
            <p class="flex gap-3 text-xs text-muted-foreground">
              <span data-testid="now-registry-refused" [class]="textClass(r.outcomes.refused > 0 ? 'warn' : 'ok')">{{ r.outcomes.refused }} refused</span>
              <span data-testid="now-registry-failed" [class]="textClass(r.outcomes.failed > 0 ? 'bad' : 'ok')">{{ r.outcomes.failed }} failed</span>
            </p>
          </section>
        }
      } @else if (service.loading()) {
        <div class="card-surface p-5 space-y-3">
          <div class="skeleton h-8 w-full"></div>
          <div class="skeleton h-24 w-full"></div>
          <div class="skeleton h-24 w-full"></div>
        </div>
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

  protected surge(e: EdgeNow): boolean {
    return isSurge(e, this.service.now()!.thresholds);
  }

  protected limited(e: EdgeNow): boolean {
    return isRateLimited(e, this.service.now()!.thresholds);
  }

  protected failing(e: EdgeNow): boolean {
    return isEdgeFailing(e, this.service.now()!.thresholds);
  }

  protected errorPercent(e: EdgeNow): string {
    const percent = edgeErrorPercent(e);
    if (percent === null) return '–';
    return percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`;
  }

  protected linkBusy(n: NodeNow): boolean {
    return isLinkBusy(n, this.service.now()!.thresholds);
  }

  protected monthHeavy(n: NodeNow): boolean {
    return isMonthHeavy(n, this.service.now()!.thresholds);
  }

  protected month(n: NodeNow): string {
    return monthPaceLabel(n);
  }

  protected cpu(percent: number | null): Level {
    return cpuLevel(percent);
  }

  protected memory(percent: number | null): Level {
    return memoryLevel(percent);
  }

  protected spaceLevel(live: number, ceiling: number): Level {
    if (ceiling <= 0) return 'ok';
    const share = (live / ceiling) * 100;
    if (share >= 100) return 'bad';
    return share >= 80 ? 'warn' : 'ok';
  }

  protected percent(value: number | null): string {
    return formatPercent(value);
  }

  protected rate(value: number): string {
    return formatRate(value);
  }

  protected percentOf(part: number, whole: number): number {
    return whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
  }

  protected clamp(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  protected mib(bytes: number): string {
    return `${(bytes / MIB).toFixed(bytes >= 100 * MIB ? 0 : 1)} MiB`;
  }

  protected mbit(bytesPerSecond: number): string {
    return formatMbitPerSecond(bytesPerSecond);
  }

  protected textClass(level: Level): string {
    if (level === 'bad') return 'text-destructive font-medium';
    if (level === 'warn') return 'text-amber-600 dark:text-amber-400 font-medium';
    return '';
  }

  protected barClass(level: Level): string {
    if (level === 'bad') return 'bg-destructive';
    if (level === 'warn') return 'bg-amber-500';
    return 'bg-primary';
  }
}
