import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import { formatLocalDateTime, formatUtcDateTime } from '../../../model/backup-activity';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { ReadOnlySectionDirective } from '../../../../shared/directives/read-only-section.directive';
import { MaskIdPipe } from '../../../../shared/pipes/mask-id.pipe';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { restoreTargetLabel } from './restore-status';
import {
  RestoreListSurfaceInput,
  RestoreListSurfaceRevision,
  buildRestoreListSurface,
  presentedContent,
} from './restore-list-surface';

const STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'active', label: 'In progress' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ACTIVE = new Set(['pending', 'previewing', 'restoring']);

@Component({
  selector: 'app-restore-list',
  imports: [
    FormsModule,
    RouterLink,
    ReadOnlySectionDirective,
    MaskIdPipe,
    BackupStatusBadgeComponent,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <fl-page-header
        [title]="'Restores (' + backup.restoreJobs().length + ')'"
        [breadcrumb]="breadcrumb"
      >
        <span headerMeta>Database restores, past and ongoing.</span>
        <ng-container headerActions>
          <button
            flButton
            type="button"
            [iconOnly]="true"
            aria-label="Refresh"
            [disabled]="loading()"
            (click)="load()"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
          <a
            flButton="primary"
            appReadOnlySection="backup"
            routerLink="/management/backup/restore/new"
            >How to restore</a
          >
        </ng-container>
      </fl-page-header>

      <fl-panel [flush]="true">
        <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
          <div class="fl-toolbar__group">
            <span class="fl-select-wrap">
              <select
                class="fl-select fl-select--sm"
                aria-label="Status"
                [ngModel]="status()"
                (ngModelChange)="status.set($event)"
              >
                <option value="">Status: All</option>
                @for (s of statuses; track s.value) {
                  <option [value]="s.value">{{ s.label }}</option>
                }
              </select>
            </span>
          </div>
          <div class="fl-toolbar__group">
            <span class="fl-toolbar__info"
              >{{ rows().length }} {{ rows().length === 1 ? 'restore' : 'restores' }}</span
            >
          </div>
        </div>

        @if (loading() && backup.restoreJobs().length === 0) {
          <fl-loading-state [rows]="4" />
        } @else if (backup.restoreJobs().length === 0) {
          <fl-empty-state
            title="No restores yet"
            body="Restores started from a backup run show up here."
          />
        } @else if (rows().length === 0) {
          <fl-empty-state title="No restores match" body="Nothing matches this filter.">
            <button flButton size="sm" type="button" (click)="status.set('')">Clear filter</button>
          </fl-empty-state>
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Restore</th>
                  <th scope="col">Target</th>
                  <th scope="col">Cluster</th>
                  <th scope="col">Backup</th>
                  <th scope="col">Created</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr>
                    <td>
                      <a
                        class="fl-link fl-mono"
                        [routerLink]="['/management/backup/restore', r.id]"
                        >{{ r.id | maskId }}</a
                      >
                    </td>
                    <td>{{ target(r.targetKind) }}</td>
                    <td>{{ clusterName(r.targetClusterId) }}</td>
                    <td class="fl-mono">{{ r.artifactId | maskId }}</td>
                    <td [attr.title]="utc(r.createdAt)">{{ local(r.createdAt) }}</td>
                    <td><app-backup-status-badge kind="restore" [value]="r.status" /></td>
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
export class RestoreListComponent implements OnInit, OnDestroy {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Restores' },
  ];
  protected readonly statuses = STATUSES;
  protected readonly loading = signal(false);
  protected readonly status = signal('');

  protected readonly rows = computed(() => {
    const status = this.status();
    return this.backup
      .restoreJobs()
      .filter((r) => !status || (status === 'active' ? ACTIVE.has(r.status) : r.status === status));
  });

  protected readonly target = restoreTargetLabel;
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

  private readonly surfaceRevision = new RestoreListSurfaceRevision();

  readonly surface = computed(() => {
    const input: RestoreListSurfaceInput = { restoreJobs: this.backup.restoreJobs() };
    return buildRestoreListSurface(input, {
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
    void this.load();
    if (this.clusterService.clusters().length === 0) {
      this.clusterService.loadClusters().catch(() => undefined);
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      await this.backup.loadRestoreJobs();
    } finally {
      this.loading.set(false);
    }
  }

  protected clusterName(id: string): string {
    return this.clusterService.clusters().find((c) => c.id === id)?.name ?? id.slice(0, 8);
  }
}
