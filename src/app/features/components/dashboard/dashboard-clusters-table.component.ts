import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { poll } from '../../../core/state/poll';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { ClusterService } from '../../service/cluster.service';
import { ApplicationService } from '../../service/application.service';
import { ProvidersService } from '../../service/providers.service';
import { FleetService } from '../../service/fleet.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AutoscaleWarningLevel } from '../../model/autoscale.models';
import { ClusterStatus } from '../../model/cluster.models';
import { ApplicationCategoryEnum } from '../../model/application.models';
import { ClusterRow, ClusterRowApps, clusterRow, statusToneOf } from './home-state';

const MAX_ROWS = 6;

@Component({
  selector: 'app-dashboard-clusters-table',
  imports: [RouterLink, FlPanel, FlTable, FlStatus, FlUsageBar, FlEmptyState],
  template: `
    <fl-panel
      title="Clusters"
      [count]="rows().length || null"
      [flush]="rows().length > 0"
      data-testid="clusters-table"
    >
      <ng-container panelActions>
        @if (fresh()) {
          <a
            routerLink="/cluster/new"
            class="fl-link text-fl-body-sm"
            data-testid="clusters-create-workload"
            >Create a workload cluster</a
          >
        } @else {
          <a routerLink="/cluster" class="fl-link text-fl-body-sm">View all</a>
        }
      </ng-container>

      @if (rows().length === 0) {
        <fl-empty-state [compact]="true" title="No clusters yet">
          <a routerLink="/cluster/new" class="fl-link">Create cluster</a>
        </fl-empty-state>
      } @else {
        <div class="fl-table-wrap">
          <table flTable>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                @if (showMetrics() && !fresh()) {
                  <th scope="col">CPU · {{ fleet.window() }}</th>
                  <th scope="col">Memory · {{ fleet.window() }}</th>
                }
                <th scope="col" class="is-num">Workloads</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr [attr.data-testid]="'cluster-row-' + row.id">
                  <td>
                    <div class="flex flex-col">
                      <a class="fl-link" [routerLink]="['/cluster', row.id]">{{ row.name }}</a>
                      <span class="text-fl-caption text-fl-ink-muted">{{ row.meta }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="inline-flex items-center gap-2">
                      <fl-status [tone]="toneOf(row)" [label]="row.status.label" />
                      @if (autoscaleWarning(row.id); as level) {
                        <a class="fl-link text-fl-caption" routerLink="/scaling">{{
                          level === 'DANGER_NEEDS_SCALE'
                            ? 'Critical pressure'
                            : 'Sustained pressure'
                        }}</a>
                      }
                    </span>
                  </td>
                  @if (showMetrics() && !fresh()) {
                    @if (row.live) {
                      <td>
                        <fl-usage-bar
                          [percent]="percentOf(row.cpuNow)"
                          [label]="row.name + ' CPU'"
                        />
                      </td>
                      <td>
                        <fl-usage-bar
                          [percent]="percentOf(row.memoryNow)"
                          [label]="row.name + ' memory'"
                        />
                      </td>
                    } @else {
                      <td colspan="2">
                        <div class="flex flex-col gap-1.5" style="min-width: 200px">
                          @if (progressFor(row); as progress) {
                            <span
                              class="fl-bar"
                              role="progressbar"
                              [attr.aria-valuenow]="progress"
                              aria-valuemin="0"
                              aria-valuemax="100"
                              [attr.aria-label]="row.name + ' progress'"
                              ><span [style.width.%]="progress"></span
                            ></span>
                          }
                          <span class="text-fl-caption text-fl-ink-muted">{{
                            row.note || '—'
                          }}</span>
                        </div>
                      </td>
                    }
                  }
                  <td class="is-num">{{ row.apps }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (fresh()) {
          <p
            class="border-t border-fl-border-subtle px-4 py-3 text-fl-caption text-fl-ink-muted"
            data-testid="clusters-fresh-hint"
          >
            Your apps run on workload clusters. Create one on any provider you have connected.
          </p>
        }
      }
    </fl-panel>
  `,
})
export class DashboardClustersTableComponent {
  readonly fresh = input(false);

  protected readonly fleet = inject(FleetService);
  private readonly clusters = inject(ClusterService);
  private readonly applications = inject(ApplicationService);
  private readonly providers = inject(ProvidersService);
  private readonly autoscale = inject(ClusterAutoscaleService);
  private readonly permissions = inject(PermissionService);

  private readonly autoscaleWarnings = signal<Record<string, AutoscaleWarningLevel>>({});

  readonly showMetrics = computed(() => this.fleet.metricsState() !== 'forbidden');

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
          (c.provider && this.providers.getProviderById(c.provider)?.displayName) ||
            (c.provider ? this.clusters.getProviderDisplayName(c.provider) : 'Unknown'),
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

  protected toneOf(row: ClusterRow): StatusTone {
    return statusToneOf(row.status.tone);
  }

  protected percentOf(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  autoscaleWarning(clusterId: string): AutoscaleWarningLevel | null {
    const level = this.autoscaleWarnings()[clusterId];
    return level && level !== 'NONE' ? level : null;
  }

  constructor() {
    poll(() => void this.refreshAutoscaleWarnings(), 30_000, { immediate: true });
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
