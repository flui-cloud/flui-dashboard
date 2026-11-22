import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { BackupPolicyActivity } from '../../../model/backup-run.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { activityByPolicyId, sortByAttention } from '../../../model/backup-activity';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { policyRow } from './policies-list-rows';
import { PoliciesListTable } from './policies-list-table';
import {
  PoliciesListSurfaceInput,
  PoliciesListSurfaceRevision,
  buildPoliciesListSurface,
  presentedContent,
} from './policies-list-surface';

@Component({
  selector: 'app-policies-list',
  imports: [
    ReadOnlySectionDirective,
    FormsModule,
    RouterLink,
    PoliciesListTable,
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="'Backup policies (' + backup.policies().length + ')'"
        [breadcrumb]="breadcrumb"
      >
        <span headerMeta>
          One policy per app and engine: continuous backups or dumps for databases, snapshots for
          volumes, and Flui itself.
        </span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="backup.loading()"
            (click)="refresh()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <a
            flButton="primary"
            appReadOnlySection="backup"
            routerLink="/management/backup/policies/new"
            >New policy</a
          >
        </ng-container>
      </fl-page-header>

      @if (backup.activityError()) {
        <fl-alert tone="warning" title="Run activity is unavailable">
          Health and run times are not shown right now.
        </fl-alert>
      }

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by name"
                aria-label="Search policies"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Cluster"
                [ngModel]="clusterFilter()"
                (ngModelChange)="clusterFilter.set($event)"
              >
                <option value="">Cluster: All</option>
                @for (c of clusters(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </span>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ rows().length }} {{ rows().length === 1 ? 'policy' : 'policies' }}</span
            >
          </div>
        </div>

        @if (backup.loading() && backup.policies().length === 0) {
          <fl-loading-state [rows]="5" />
        } @else if (backup.policies().length === 0) {
          <fl-empty-state
            title="No backup policies yet"
            body="A policy says what to back up, when, and where the copies go."
          >
            <a
              flButton="primary"
              size="sm"
              appReadOnlySection="backup"
              routerLink="/management/backup/policies/new"
            >
              New policy
            </a>
          </fl-empty-state>
        } @else if (rows().length === 0) {
          <fl-empty-state title="No policies match" body="Nothing matches these filters.">
            <button flButton size="sm" type="button" (click)="clearFilters()">Clear filters</button>
          </fl-empty-state>
        } @else {
          <app-policies-list-table [rows]="rows()" [activityLoaded]="backup.activityLoaded()" />
        }
      </fl-panel>
    </div>
  `,
})
export class PoliciesListComponent implements OnInit, OnDestroy {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Policies' },
  ];

  readonly clusters = this.clusterService.clusters;
  readonly clusterFilter = signal('');
  protected readonly search = signal('');

  private readonly activityById = computed(() => activityByPolicyId(this.backup.activity()));

  readonly filtered = computed(() => {
    const id = this.clusterFilter();
    const all = this.backup.policies();
    const byId = this.activityById();
    const visible = id ? all.filter((p) => p.clusterId === id) : all;
    return sortByAttention(visible, (p) => byId.get(p.id)?.health.state);
  });

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.filtered()
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => policyRow(p, this.clusterName(p.clusterId), this.activityFor(p.id)));
  });

  private readonly surfaceRevision = new PoliciesListSurfaceRevision();

  readonly surface = computed(() => {
    const clusterId = this.clusterFilter();
    const input: PoliciesListSurfaceInput = {
      rows: this.filtered().map((policy) => ({
        policy,
        clusterName: this.clusterName(policy.clusterId),
        activity: this.activityFor(policy.id),
      })),
      totalPolicies: this.backup.policies().length,
      clusterFilterName: clusterId ? this.clusterName(clusterId) : null,
      loading: this.backup.loading(),
    };
    return buildPoliciesListSurface(input, {
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
    void (async () => {
      await Promise.all([
        this.backup.loadPolicies(),
        this.backup.loadActivity(),
        this.clusterService.loadClusters(),
      ]);
    })();
  }

  protected refresh(): void {
    void Promise.all([this.backup.loadPolicies(), this.backup.loadActivity()]);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.clusterFilter.set('');
  }

  activityFor(policyId: string): BackupPolicyActivity | null {
    return this.activityById().get(policyId) ?? null;
  }

  clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }

  readonly engineLabel = policyEngineLabel;
}
