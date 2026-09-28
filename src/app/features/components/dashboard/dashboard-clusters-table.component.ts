import { Component, OnDestroy, OnInit, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucidePlus } from '@ng-icons/lucide';
import { SparkLineComponent, NODE_SERIES_COLORS } from '../../../shared/components/charts';
import { ClusterService } from '../../service/cluster.service';
import { ApplicationService } from '../../service/application.service';
import { ProvidersService } from '../../service/providers.service';
import { FleetService } from '../../service/fleet.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AutoscaleWarningLevel } from '../../model/autoscale.models';
import { ClusterStatus } from '../../model/cluster.models';
import { ApplicationCategoryEnum } from '../../model/application.models';
import { ClusterRow, ClusterRowApps, Tone, clusterRow } from './home-state';

const MAX_ROWS = 6;

const DOT: Record<Tone, string> = {
  ok: 'bg-green-500',
  info: 'bg-primary',
  warn: 'bg-amber-500',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
};

const TEXT: Record<Tone, string> = {
  ok: 'text-green-700 dark:text-green-400',
  info: 'text-primary',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

@Component({
  selector: 'app-dashboard-clusters-table',
  standalone: true,
  imports: [RouterLink, NgIconComponent, SparkLineComponent],
  providers: [provideIcons({ lucideArrowRight, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="card-surface overflow-hidden" data-testid="clusters-table">
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 class="font-semibold text-foreground">Clusters</h2>
        @if (fresh()) {
          <a routerLink="/cluster/new" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="clusters-create-workload">
            <ng-icon name="lucidePlus" class="h-3 w-3" />
            Create a workload cluster
          </a>
        } @else {
          <a routerLink="/cluster" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all
            <ng-icon name="lucideArrowRight" class="h-3 w-3" />
          </a>
        }
      </div>

      @if (rows().length === 0) {
        <div class="px-5 py-8 text-center">
          <p class="text-sm text-muted-foreground">No clusters yet</p>
          <a routerLink="/cluster/new" class="text-xs text-primary hover:underline mt-1 inline-block">Create your first cluster</a>
        </div>
      } @else {
        @if (!fresh()) {
          <div class="hidden md:grid gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" [style.grid-template-columns]="columns()">
            <span>Cluster</span>
            <span>Status</span>
            @if (showMetrics()) {
              <span>CPU · {{ fleet.window() }}</span>
              <span>Memory · {{ fleet.window() }}</span>
            }
            <span class="text-right">Apps</span>
          </div>
        }
        @for (row of rows(); track row.id) {
          <a
            [routerLink]="['/cluster', row.id]"
            class="flex flex-wrap md:grid gap-3 items-center px-5 py-3 border-t border-border first-of-type:border-t-0 hover:bg-muted/40 transition-colors"
            [style.grid-template-columns]="columns()"
            [attr.data-testid]="'cluster-row-' + row.id"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
              <span class="icon-chip icon-chip-sm chip-brand text-[11px] font-bold">{{ row.chip }}</span>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-semibold text-foreground truncate">{{ row.name }}</span>
                <span class="text-xs text-muted-foreground truncate">{{ row.meta }}</span>
              </div>
            </div>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium" [class]="text(row)">
              <span class="h-1.5 w-1.5 rounded-full" [class]="dot(row)"></span>
              {{ row.status.label }}
              @if (autoscaleWarning(row.id); as level) {
                <span
                  class="ml-1 text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded"
                  [class]="level === 'DANGER_NEEDS_SCALE' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'"
                  [title]="level === 'DANGER_NEEDS_SCALE' ? 'Critical pressure — open Scaling' : 'Sustained pressure — open Scaling'"
                >{{ level === 'DANGER_NEEDS_SCALE' ? 'alert' : 'warn' }}</span>
              }
            </span>
            @if (showMetrics() && !fresh()) {
              @if (row.live) {
                <div class="hidden md:flex items-center gap-2">
                  <app-spark-line [values]="row.cpu" [color]="cpuColor" [width]="72" [height]="22" ariaLabel="CPU trend" />
                  <span class="text-xs font-mono tabular-nums">{{ row.cpuNow }}</span>
                </div>
                <div class="hidden md:flex items-center gap-2">
                  <app-spark-line [values]="row.memory" [color]="memoryColor" [width]="72" [height]="22" ariaLabel="Memory trend" />
                  <span class="text-xs font-mono tabular-nums">{{ row.memoryNow }}</span>
                </div>
              } @else {
                <div class="hidden md:flex flex-col gap-1.5 md:col-span-2">
                  @if (progressFor(row) !== null) {
                    <div class="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div class="h-full rounded-full" [class]="dot(row)" [style.width.%]="progressFor(row)"></div>
                    </div>
                  }
                  <span class="text-xs text-muted-foreground">{{ row.note || '—' }}</span>
                </div>
              }
            }
            <span class="text-xs text-muted-foreground md:text-right">{{ row.apps }}</span>
          </a>
        }
        @if (fresh()) {
          <p class="px-5 py-3 border-t border-border text-xs text-muted-foreground bg-muted/30" data-testid="clusters-fresh-hint">
            Your apps run on workload clusters. Create one on any provider you have connected.
          </p>
        }
      }
    </section>
  `,
})
export class DashboardClustersTableComponent implements OnInit, OnDestroy {
  readonly fresh = input(false);

  protected readonly fleet = inject(FleetService);
  private readonly clusters = inject(ClusterService);
  private readonly applications = inject(ApplicationService);
  private readonly providers = inject(ProvidersService);
  private readonly autoscale = inject(ClusterAutoscaleService);
  private readonly permissions = inject(PermissionService);

  protected readonly cpuColor = NODE_SERIES_COLORS[0];
  protected readonly memoryColor = NODE_SERIES_COLORS[1];

  private readonly autoscaleWarnings = signal<Record<string, AutoscaleWarningLevel>>({});
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  readonly showMetrics = computed(() => this.fleet.metricsState() !== 'forbidden');

  readonly columns = computed(() => {
    if (this.fresh()) return 'minmax(0,1.7fr) 0.9fr 0.9fr';
    return this.showMetrics()
      ? 'minmax(0,1.7fr) 0.9fr 1fr 1fr 0.7fr'
      : 'minmax(0,1.7fr) 0.9fr 0.7fr';
  });

  private readonly appsByCluster = computed(() => {
    const map = new Map<string, ClusterRowApps>();
    for (const group of this.applications.applicationGroups()) {
      const entry = map.get(group.clusterId) ?? { user: 0, system: 0 };
      if (group.category === ApplicationCategoryEnum.System) entry.system += 1;
      else entry.user += 1;
      map.set(group.clusterId, entry);
    }
    return map;
  });

  readonly rows = computed<ClusterRow[]>(() => {
    const metrics = new Map((this.fleet.metrics()?.clusters ?? []).map((m) => [m.clusterId, m]));
    const apps = this.appsByCluster();
    return this.clusters
      .clusters()
      .filter((c) => !!c.id)
      .slice(0, MAX_ROWS)
      .map((c) =>
        clusterRow(
          c,
          metrics.get(c.id!),
          apps.get(c.id!),
          (c.provider && this.providers.getProviderById(c.provider)?.displayName) || c.provider || 'Unknown',
        ),
      );
  });

  private readonly creatingCount = computed(
    () => this.clusters.clusters().filter((c) => c.status === ClusterStatus.CREATING).length,
  );

  protected progressFor(row: ClusterRow): number | null {
    if (row.clusterStatus !== ClusterStatus.CREATING || this.creatingCount() !== 1) return null;
    const p = this.clusters.progress();
    return p > 0 && p < 100 ? p : null;
  }

  protected dot(row: ClusterRow): string {
    return DOT[row.status.tone];
  }

  protected text(row: ClusterRow): string {
    return TEXT[row.status.tone];
  }

  autoscaleWarning(clusterId: string): AutoscaleWarningLevel | null {
    const level = this.autoscaleWarnings()[clusterId];
    return level && level !== 'NONE' ? level : null;
  }

  ngOnInit(): void {
    void this.refreshAutoscaleWarnings();
    this.pollHandle = setInterval(() => void this.refreshAutoscaleWarnings(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  private async refreshAutoscaleWarnings(): Promise<void> {
    if (!this.permissions.hasSection('clusters')) return;
    const ids = this.clusters
      .clusters()
      .filter((c) => c.status === ClusterStatus.ACTIVE && !!c.id)
      .map((c) => c.id!);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => this.autoscale.fetchStatusFor(id)));
    const next: Record<string, AutoscaleWarningLevel> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[ids[i]] = r.value.warning;
    });
    this.autoscaleWarnings.set(next);
  }
}
