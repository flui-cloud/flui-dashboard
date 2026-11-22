import { Component, inject, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePackage, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { ClusterService } from '../../service/cluster.service';
import { PlatformComponentsService } from '../../service/platform-components.service';
import { PlatformComponentDetailPanelComponent } from './platform-component-detail-panel.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import {
  PlatformComponentsListSurfaceInput,
  PlatformComponentsListSurfaceRevision,
  VisibleComponent,
  buildPlatformComponentsListSurface,
  presentedContent,
} from './platform-components-list-surface';
import { ClusterComponent, clusterGroups, createdAtOf } from './platform-components-rows';
import { PlatformComponentsTable } from './platform-components-table';

@Component({
  selector: 'app-platform-components-list',
  imports: [
    FormsModule,
    FlPageHeader,
    FlPanel,
    FlMetricStrip,
    FlMetric,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    PlatformComponentsTable,
    PlatformComponentDetailPanelComponent,
  ],
  providers: [provideIcons({ lucidePackage, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="'Platform components (' + service.allComponents().length + ')'">
        <span headerMeta>Live status of core system components across all clusters</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            title="Refresh"
            [disabled]="service.globalLoading()"
            (click)="reload()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      @if (!service.globalLoading() && service.allComponents().length > 0) {
        <fl-metric-strip>
          <fl-metric label="Healthy" [value]="service.healthyCount()" />
          <fl-metric
            label="Degraded"
            [value]="service.degradedCount()"
            [tone]="service.degradedCount() > 0 ? 'warning' : 'default'"
          />
          <fl-metric
            label="Missing"
            [value]="service.missingCount()"
            [tone]="service.missingCount() > 0 ? 'warning' : 'default'"
          />
        </fl-metric-strip>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name or category"
                aria-label="Search components"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Status"
                [ngModel]="statusFilter()"
                (ngModelChange)="statusFilter.set($event)"
              >
                <option value="">Status: All</option>
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="missing">Missing</option>
              </select>
            </span>
            @if (availableClusters().length > 1) {
              <span class="fl-select-wrap">
                <select
                  class="fl-select fl-select--sm"
                  aria-label="Cluster"
                  [ngModel]="clusterFilter()"
                  (ngModelChange)="clusterFilter.set($event)"
                >
                  <option value="">Cluster: All</option>
                  @for (c of availableClusters(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </span>
            }
            @if (hasFilters()) {
              <button flButton="ghost" size="sm" type="button" (click)="clearFilters()">
                Clear filters
              </button>
            }
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ filteredComponents().length }}
              {{ filteredComponents().length === 1 ? 'component' : 'components' }}</span
            >
          </div>
        </div>

        @if (service.globalLoading() && service.allComponents().length === 0) {
          <fl-loading-state [rows]="6" />
        } @else if (!service.globalLoading() && service.entries().length === 0) {
          <fl-empty-state
            icon="lucidePackage"
            title="No clusters available"
            body="Platform components appear once a cluster is running."
          />
        } @else if (
          !service.globalLoading() &&
          filteredComponents().length === 0 &&
          service.allComponents().length > 0
        ) {
          <fl-empty-state title="No matching components" body="Nothing matches these filters.">
            <button flButton size="sm" type="button" (click)="clearFilters()">Clear filters</button>
          </fl-empty-state>
        } @else {
          <app-platform-components-table
            [groups]="groups()"
            [openKey]="openKey()"
            (open)="toggleExpand($event.clusterId, $event.key)"
          />
        }
      </fl-panel>
    </div>

    @if (openComponent(); as comp) {
      <app-platform-component-detail-panel
        #detailPanel
        [component]="comp"
        [clusterId]="comp.clusterId"
        [clusterName]="comp.clusterName"
        [isRedeploying]="service.isRedeploying(comp.clusterId, comp.key)"
        (redeployRequested)="onRedeployRequested(comp.clusterId, comp.key, detailPanel)"
        (closed)="toggleExpand(comp.clusterId, comp.key)"
      />
    }
  `,
})
export class PlatformComponentsListComponent implements OnInit, OnDestroy {
  readonly service = inject(PlatformComponentsService);
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly confirm = inject(ConfirmService);
  private readonly surfaceRevision = new PlatformComponentsListSurfaceRevision();

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly clusterFilter = signal('');

  private readonly expandedKeys = signal<Set<string>>(new Set());

  readonly hasFilters = computed(
    () => !!(this.searchQuery() || this.statusFilter() || this.clusterFilter()),
  );

  readonly groups = computed(() =>
    clusterGroups(this.service.entries(), {
      search: this.searchQuery(),
      status: this.statusFilter(),
      cluster: this.clusterFilter(),
    }),
  );

  private readonly surfaceVisibleComponents = computed<VisibleComponent[]>(() =>
    this.groups().flatMap((g) => g.components),
  );

  readonly openKey = computed(() => this.expandedKeys().values().next().value ?? null);

  readonly openComponent = computed<ClusterComponent | null>(() => {
    const key = this.openKey();
    if (!key) return null;
    return this.service.allComponents().find((c) => `${c.clusterId}:${c.key}` === key) ?? null;
  });

  readonly surface = computed(() => {
    const input: PlatformComponentsListSurfaceInput = {
      visibleComponents: this.surfaceVisibleComponents(),
      totalCount: this.service.allComponents().length,
      isLoading: this.service.globalLoading(),
      searchQuery: this.searchQuery(),
      statusFilter: this.statusFilter(),
      clusterFilter: this.clusterFilter(),
      expandedKeys: this.expandedKeys(),
      createdAtOf: (c) => this.getCreatedAt(c),
    };
    return buildPlatformComponentsListSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  readonly availableClusters = computed(() =>
    this.service.entries().map((e) => ({ id: e.clusterId, name: e.clusterName })),
  );

  readonly filteredComponents = computed(() => this.groups().flatMap((g) => g.components));

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    void (async () => {
      if (this.clusterService.clusters().length === 0) {
        await this.clusterService.loadClusters();
      }
      await this.reload();
    })();
  }

  async reload(): Promise<void> {
    const clusters = this.clusterService
      .clusters()
      .filter((c) => !!c.id)
      .map((c) => ({ id: c.id!, name: c.name ?? c.id! }));
    if (clusters.length > 0) {
      await this.service.loadForClusters(clusters);
    }
  }

  toggleExpand(clusterId: string, key: string): void {
    const k = `${clusterId}:${key}`;
    this.expandedKeys.set(this.expandedKeys().has(k) ? new Set() : new Set([k]));
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('');
    this.clusterFilter.set('');
  }

  async onRedeployRequested(
    clusterId: string,
    componentKey: string,
    panel: PlatformComponentDetailPanelComponent,
  ): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Redeploy ${componentKey}`,
      body: 'This triggers a rolling restart of every workload resource of the component. It does not change its configuration or images.',
      confirmLabel: 'Redeploy',
    });
    if (!ok) return;
    const result = await this.service.redeployComponent(clusterId, componentKey);
    if (result) panel.setRedeployResult(result);
  }

  getCreatedAt = createdAtOf;
}
