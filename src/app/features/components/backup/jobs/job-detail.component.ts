import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { BackupJob, formatBytes } from '../../../model/backup.models';
import {
  formatDuration,
  formatLocalDateTime,
  formatUtcDateTime,
  runTriggerLabel,
} from '../../../model/backup-activity';
import { BackupStatusBadgeComponent } from '../shared/status-badge.component';
import { BackupProgressModalComponent } from '../shared/progress-modal.component';
import { CurrentSurfaceService } from '../../../../core/services/current-surface.service';
import { MaskIdPipe } from '../../../../shared/pipes/mask-id.pipe';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlCopyId } from '../../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { jobDurationSeconds } from './job-duration';
import {
  JobDetailSurfaceInput,
  JobDetailSurfaceRevision,
  buildJobDetailSurface,
  presentedContent,
} from './job-detail-surface';

@Component({
  selector: 'app-job-detail',
  imports: [
    RouterLink,
    MaskIdPipe,
    BackupStatusBadgeComponent,
    BackupProgressModalComponent,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
  ],
  template: `
    <div class="fl-page">
      @if (job(); as j) {
        <fl-page-header title="Backup job" [breadcrumb]="crumbs(j.id | maskId)">
          <app-backup-status-badge headerStatus kind="job" [value]="j.status" />
          <fl-copy-id headerMeta [value]="j.id" [display]="j.id | maskId" label="job ID" />
          <span headerMeta>{{ trigger(j.triggerType) }}</span>
        </fl-page-header>

        @if (j.errorMessage) {
          <fl-alert
            [tone]="j.status === 'failed' ? 'error' : 'warning'"
            [title]="j.status === 'failed' ? 'Backup failed' : 'Backup reported a problem'"
          >
            <pre class="fl-mono m-0 whitespace-pre-wrap break-words">{{ j.errorMessage }}</pre>
          </fl-alert>
        }

        <fl-panel title="Details">
          <fl-key-value>
            <fl-kv-item key="Trigger">{{ trigger(j.triggerType) }}</fl-kv-item>
            <fl-kv-item key="Started">
              <span [attr.title]="utc(j.startedAt)">{{ local(j.startedAt) }}</span>
            </fl-kv-item>
            <fl-kv-item key="Finished">
              <span [attr.title]="utc(j.finishedAt)">{{ local(j.finishedAt) }}</span>
            </fl-kv-item>
            <fl-kv-item key="Duration" [mono]="true">{{ duration(seconds(j)) }}</fl-kv-item>
            <fl-kv-item key="Policy">
              @if (j.policyId) {
                <a class="fl-link" [routerLink]="['/management/backup/policies', j.policyId]">{{
                  policyName(j.policyId)
                }}</a>
              } @else {
                None
              }
            </fl-kv-item>
            <fl-kv-item key="Cluster" [mono]="true">{{ j.clusterId | maskId }}</fl-kv-item>
          </fl-key-value>
        </fl-panel>

        @if (stops(j).length) {
          <fl-panel title="App stopped during the copy" [count]="stops(j).length" [flush]="true">
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Volume</th>
                    <th scope="col" class="is-num">Stopped for</th>
                  </tr>
                </thead>
                <tbody>
                  @for (stop of stops(j); track stop.volume) {
                    <tr>
                      <td class="fl-mono">{{ stop.volume }}</td>
                      <td class="is-num fl-mono">{{ stop.seconds }} s</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </fl-panel>
        }

        @if (j.artifact; as a) {
          <fl-panel title="Artifact">
            <ng-container panelActions>
              @if (a.engineClass === 'database') {
                <a
                  flButton
                  size="sm"
                  [routerLink]="['/management/backup/restore/new']"
                  [queryParams]="{ artifact: a.id, kind: 'database' }"
                >
                  Restore into a new database
                </a>
              }
            </ng-container>
            <fl-key-value>
              <fl-kv-item key="Size">{{ size(a.sizeBytes) }}</fl-kv-item>
              <fl-kv-item key="Items">{{ a.itemCount || '—' }}</fl-kv-item>
              <fl-kv-item key="Expires">
                <span [attr.title]="utc(a.expiresAt)">{{ local(a.expiresAt) }}</span>
              </fl-kv-item>
              <fl-kv-item key="Artifact ID">
                <fl-copy-id [value]="a.id" [display]="a.id | maskId" label="artifact ID" />
              </fl-kv-item>
            </fl-key-value>
          </fl-panel>

          <fl-panel title="Locations" [count]="a.locations.length" [flush]="true">
            @if (a.locations.length === 0) {
              <fl-empty-state [compact]="true" title="Not stored anywhere yet" />
            } @else {
              <div class="fl-table-wrap">
                <table flTable density="dense">
                  <thead>
                    <tr>
                      <th scope="col">Destination</th>
                      <th scope="col">Role</th>
                      <th scope="col" class="is-num">Stored</th>
                      <th scope="col">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (loc of a.locations; track loc.id) {
                      <tr>
                        <td>
                          <a
                            class="fl-link"
                            [routerLink]="['/management/backup/destinations', loc.destinationId]"
                            >{{ loc.destination?.name || loc.destinationId.slice(0, 8) }}</a
                          >
                        </td>
                        <td>{{ loc.role === 'primary' ? 'Primary' : 'Replica' }}</td>
                        <td class="is-num">{{ size(loc.bytesStored) }}</td>
                        <td [attr.title]="loc.lastError || null">
                          <app-backup-status-badge kind="location" [value]="loc.state" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </fl-panel>
        }

        <app-backup-progress-modal
          [operationId]="opId()"
          title="Backup in progress"
          (closed)="opId.set(null)"
        />
      } @else if (loaded()) {
        <fl-page-header title="Backup job" [breadcrumb]="crumbs('Not found')" />
        <fl-panel>
          <fl-empty-state title="Backup job not found" body="It may have expired or been removed.">
            <a flButton size="sm" routerLink="/management/backup/jobs">Back to jobs</a>
          </fl-empty-state>
        </fl-panel>
      } @else {
        <fl-page-header title="Backup job" [breadcrumb]="crumbs('Loading')" />
        <fl-panel><fl-loading-state [rows]="5" /></fl-panel>
      }
    </div>
  `,
})
export class JobDetailComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly job = signal<BackupJob | null>(null);
  protected readonly loaded = signal(false);
  protected readonly opId = signal<string | null>(null);

  protected stops(j: BackupJob): Array<{ volume: string; seconds: number }> {
    return Object.entries(j.metadata?.stoppedSeconds ?? {}).map(([volume, seconds]) => ({
      volume,
      seconds,
    }));
  }
  protected readonly size = formatBytes;
  protected readonly trigger = runTriggerLabel;
  protected readonly duration = formatDuration;
  protected readonly seconds = jobDurationSeconds;
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

  protected crumbs(last: string): readonly Crumb[] {
    return [
      { label: 'Backups', link: '/management/backup' },
      { label: 'Jobs', link: '/management/backup/jobs' },
      { label: last },
    ];
  }

  protected policyName(policyId: string): string {
    return this.backup.policies().find((p) => p.id === policyId)?.name ?? 'Open policy';
  }

  private readonly surfaceRevision = new JobDetailSurfaceRevision();

  readonly surface = computed(() => {
    const input: JobDetailSurfaceInput = { job: this.job() };
    const content = presentedContent(input);
    if (!content) return null;
    return buildJobDetailSurface(input, {
      revision: this.surfaceRevision.next(content),
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
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;
      const j = await this.backup.getJob(id);
      this.job.set(j);
      this.loaded.set(true);
      if (
        j?.infrastructureOperationId &&
        this.backup.activeOperations()[j.infrastructureOperationId]
      ) {
        this.opId.set(j.infrastructureOperationId);
      }
    })();
  }
}
