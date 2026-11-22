import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { ApplicationService } from '../../../service/application.service';
import { formatBytes } from '../../../model/backup.models';
import {
  formatDuration,
  formatLocalDateTime,
  formatUtcDateTime,
  runTriggerLabel,
} from '../../../model/backup-activity';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import { MaskIdPipe } from '../../../../shared/pipes/mask-id.pipe';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { jobDurationSeconds } from './job-duration';
import {
  JobsListSurfaceInput,
  JobsListSurfaceRevision,
  buildJobsListSurface,
  presentedContent,
} from './jobs-list-surface';

const OUTCOMES = [
  { value: 'completed', label: 'Completed' },
  { value: 'partially_completed', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'In progress' },
  { value: 'cancelled', label: 'Cancelled' },
];

const IN_PROGRESS = new Set(['pending', 'running', 'uploading', 'replicating']);

@Component({
  selector: 'app-jobs-list',
  imports: [
    FormsModule,
    RouterLink,
    MaskIdPipe,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
    BackupStatusBadgeComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="clusterFilter() ? 'Backup jobs (' + jobs().length + ')' : 'Backup jobs'"
        [breadcrumb]="breadcrumb"
      >
        <span headerMeta>Recent backup runs, on demand and scheduled.</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="!clusterFilter() || loading()"
            (click)="onClusterChange(clusterFilter())"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </fl-page-header>

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Cluster"
                [ngModel]="clusterFilter()"
                (ngModelChange)="clusterFilter.set($event); onClusterChange($event)"
              >
                <option value="">Choose a cluster</option>
                @for (c of clusters(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </span>
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <span class="fl-sr">Search</span>
              <input
                type="search"
                placeholder="Search by policy, app or job ID"
                aria-label="Search jobs"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Outcome"
                [ngModel]="outcome()"
                (ngModelChange)="outcome.set($event)"
              >
                <option value="">Outcome: All</option>
                @for (o of outcomes; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </span>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ rows().length }} {{ rows().length === 1 ? 'job' : 'jobs' }}</span
            >
          </div>
        </div>

        @if (!clusterFilter()) {
          <fl-empty-state
            title="Choose a cluster"
            body="Backup history is kept per cluster. Pick one to see its runs."
          />
        } @else if (loading() && jobs().length === 0) {
          <fl-loading-state [rows]="5" />
        } @else if (jobs().length === 0) {
          <fl-empty-state
            title="No backup jobs yet"
            body="Runs appear here once a policy on this cluster backs something up."
          />
        } @else if (rows().length === 0) {
          <fl-empty-state title="No jobs match" body="Nothing matches these filters.">
            <button flButton size="sm" type="button" (click)="clearFilters()">Clear filters</button>
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Cluster</th>
                  <th scope="col">App</th>
                  <th scope="col">Trigger</th>
                  <th scope="col">Started</th>
                  <th scope="col" class="is-num">Duration</th>
                  <th scope="col" class="is-num">Size</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                @for (j of rows(); track j.id) {
                  <tr>
                    <td>
                      <a class="fl-link fl-mono" [routerLink]="['/management/backup/jobs', j.id]">{{
                        j.id | maskId
                      }}</a>
                    </td>
                    <td>
                      @if (j.policyId) {
                        <a
                          class="fl-link"
                          [routerLink]="['/management/backup/policies', j.policyId]"
                          >{{ policyName(j.policyId) }}</a
                        >
                      } @else {
                        <span class="text-fl-ink-muted">None</span>
                      }
                    </td>
                    <td>{{ clusterName(j.clusterId) }}</td>
                    <td>{{ appName(j.policyId) }}</td>
                    <td class="text-fl-ink-muted">{{ trigger(j.triggerType) }}</td>
                    <td [attr.title]="utc(j.startedAt || j.createdAt)">
                      {{ local(j.startedAt || j.createdAt) }}
                    </td>
                    <td class="is-num fl-mono">{{ duration(seconds(j)) }}</td>
                    <td class="is-num">{{ size(j.artifact?.sizeBytes) }}</td>
                    <td><app-backup-status-badge kind="job" [value]="j.status" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class JobsListComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly appService = inject(ApplicationService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Jobs' },
  ];
  protected readonly outcomes = OUTCOMES;

  readonly clusters = this.clusterService.clusters;
  readonly jobs = this.backup.jobs;
  readonly clusterFilter = signal('');
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly outcome = signal('');

  private readonly policiesById = computed(
    () => new Map(this.backup.policies().map((p) => [p.id, p])),
  );
  private readonly appsById = computed(
    () => new Map(this.appService.applications().map((a) => [a.id, a.name])),
  );

  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const outcome = this.outcome();
    return this.jobs().filter((j) => {
      if (outcome === 'running' ? !IN_PROGRESS.has(j.status) : outcome && j.status !== outcome) {
        return false;
      }
      if (!q) return true;
      const text = `${j.id} ${this.policyName(j.policyId)} ${this.appName(j.policyId)}`;
      return text.toLowerCase().includes(q);
    });
  });

  protected readonly trigger = runTriggerLabel;
  protected readonly duration = formatDuration;
  protected readonly seconds = jobDurationSeconds;
  protected readonly size = formatBytes;
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

  private readonly surfaceRevision = new JobsListSurfaceRevision();

  readonly surface = computed(() => {
    const clusterId = this.clusterFilter();
    const input: JobsListSurfaceInput = {
      jobs: this.jobs(),
      clusterFilterName: clusterId
        ? (this.clusters().find((c) => c.id === clusterId)?.name ?? clusterId)
        : null,
    };
    return buildJobsListSurface(input, {
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
      await this.clusterService.loadClusters();
    })();
    if (this.backup.policies().length === 0) void this.backup.loadPolicies();
  }

  async onClusterChange(id: string): Promise<void> {
    if (!id) return;
    this.loading.set(true);
    try {
      await this.backup.loadJobsByCluster(id);
    } finally {
      this.loading.set(false);
    }
  }

  protected clearFilters(): void {
    this.search.set('');
    this.outcome.set('');
  }

  protected clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }

  protected policyName(policyId: string | undefined): string {
    if (!policyId) return '';
    return this.policiesById().get(policyId)?.name ?? 'Policy';
  }

  protected appName(policyId: string | undefined): string {
    const ids = policyId ? this.policiesById().get(policyId)?.scopeSelector?.applicationIds : null;
    if (!ids?.length) return '—';
    if (ids.length > 1) return `${ids.length} apps`;
    return this.appsById().get(ids[0]) ?? '—';
  }
}
