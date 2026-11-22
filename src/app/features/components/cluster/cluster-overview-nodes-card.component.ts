import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideServer } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { ClusterMonitoringService } from '../../service/cluster-monitoring.service';
import { architectureLabel } from '../../../shared/components/architecture-badge.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { OVERVIEW_NODE_LIMIT, buildOverviewNodeRows } from './cluster-overview-nodes';

@Component({
  selector: 'app-cluster-overview-nodes-card',
  host: { class: 'block' },
  imports: [
    RouterModule,
    FlPanel,
    FlTable,
    FlUsageBar,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlTag,
  ],
  providers: [provideIcons({ lucideServer })],
  template: `
    <fl-panel
      title="Nodes"
      [count]="total()"
      [flush]="rows().length > 0"
      data-testid="cluster-overview-nodes"
    >
      <ng-container panelActions>
        @if (cluster()?.autoScalingEnabled) {
          <span class="fl-toolbar__info"
            >Autoscale {{ cluster()?.minNodes }} to {{ cluster()?.maxNodes }}</span
          >
        }
        <a [routerLink]="['../nodes']" class="fl-link text-fl-body-sm">View all nodes</a>
      </ng-container>

      @if (clusterService.nodesIsLoading() && rows().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (rows().length === 0) {
        <fl-empty-state [compact]="true" icon="lucideServer" title="No nodes loaded" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Type · location</th>
                <th scope="col">CPU</th>
                <th scope="col">Memory</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td>
                    <span class="flex min-w-0 items-center gap-2">
                      @if (row.link) {
                        <a
                          [routerLink]="row.link"
                          class="fl-link fl-mono truncate"
                          [title]="row.name"
                          >{{ row.name }}</a
                        >
                      } @else {
                        <span class="fl-mono truncate" [title]="row.name">{{ row.name }}</span>
                      }
                      @if (row.role) {
                        <fl-tag>{{ row.role }}</fl-tag>
                      }
                      @if (arch(row.architecture); as label) {
                        <fl-tag
                          data-testid="architecture-badge"
                          [attr.title]="'CPU architecture: ' + label"
                          >{{ label }}</fl-tag
                        >
                      }
                    </span>
                  </td>
                  <td class="text-fl-ink-muted">{{ meta(row.serverType, row.location) }}</td>
                  <td>
                    @if (row.cpu === null) {
                      <span class="text-fl-ink-muted">—</span>
                    } @else {
                      <fl-usage-bar
                        [percent]="row.cpu"
                        [label]="row.name + ' CPU'"
                        [warnAt]="70"
                        [criticalAt]="90"
                      />
                    }
                  </td>
                  <td>
                    @if (row.memory === null) {
                      <span class="text-fl-ink-muted">—</span>
                    } @else {
                      <fl-usage-bar
                        [percent]="row.memory"
                        [label]="row.name + ' memory'"
                        [warnAt]="75"
                        [criticalAt]="90"
                      />
                    }
                  </td>
                  <td>
                    @if (row.statusLabel) {
                      <fl-status [tone]="row.tone" [label]="sentence(row.statusLabel)" />
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (hiddenCount() > 0) {
          <p class="m-0 border-t border-fl-border-subtle px-4 py-3 text-fl-body-sm">
            <a [routerLink]="['../nodes']" class="fl-link">{{ hiddenCount() }} more nodes</a>
          </p>
        }
      }
    </fl-panel>
  `,
})
export class ClusterOverviewNodesCardComponent {
  readonly clusterService = inject(ClusterService);
  private readonly monitoring = inject(ClusterMonitoringService);

  readonly cluster = this.clusterService.cluster;
  readonly rows = computed(() =>
    buildOverviewNodeRows(this.clusterService.nodes(), this.monitoring.servers()),
  );
  readonly total = computed(
    () => this.clusterService.nodes().length || this.cluster()?.nodeCount || 0,
  );
  readonly hiddenCount = computed(() =>
    Math.max(0, this.clusterService.nodes().length - OVERVIEW_NODE_LIMIT),
  );

  protected readonly arch = architectureLabel;

  meta(serverType: string | null, location: string | null): string {
    return [serverType, location].filter(Boolean).join(' · ') || '—';
  }

  sentence(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
