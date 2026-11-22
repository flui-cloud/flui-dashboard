import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { RestoreJob } from '../../../model/backup.models';
import { formatLocalDateTime, formatUtcDateTime } from '../../../model/backup-activity';
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
import { FlButton } from '../../../../ui/primitives/button';
import { restoreTargetLabel } from './restore-status';
import {
  RestoreDetailSurfaceInput,
  RestoreDetailSurfaceRevision,
  buildRestoreDetailSurface,
  presentedContent,
} from './restore-detail-surface';

@Component({
  selector: 'app-restore-detail',
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
    FlButton,
  ],
  template: `
    <div class="fl-page">
      @if (job(); as r) {
        <fl-page-header title="Restore job" [breadcrumb]="crumbs(r.id | maskId)">
          <app-backup-status-badge headerStatus kind="restore" [value]="r.status" />
          <fl-copy-id headerMeta [value]="r.id" [display]="r.id | maskId" label="restore ID" />
          <span headerMeta>{{ target(r.targetKind) }} restore</span>
        </fl-page-header>

        @if (r.errorMessage) {
          <fl-alert tone="error" title="Restore failed">
            <pre class="fl-mono m-0 whitespace-pre-wrap break-words">{{ r.errorMessage }}</pre>
          </fl-alert>
        }

        <fl-panel title="Details">
          <fl-key-value>
            <fl-kv-item key="Target">{{ target(r.targetKind) }}</fl-kv-item>
            <fl-kv-item key="Target cluster">
              <fl-copy-id
                [value]="r.targetClusterId"
                [display]="r.targetClusterId | maskId"
                label="cluster ID"
              />
            </fl-kv-item>
            <fl-kv-item key="Created">
              <span [attr.title]="utc(r.createdAt)">{{ local(r.createdAt) }}</span>
            </fl-kv-item>
            @if (r.strategy) {
              <fl-kv-item key="Strategy" [mono]="true">{{ r.strategy }}</fl-kv-item>
            }
            <fl-kv-item key="Backup">
              <fl-copy-id
                [value]="r.artifactId"
                [display]="r.artifactId | maskId"
                label="backup ID"
              />
            </fl-kv-item>
            <fl-kv-item key="Source destination">
              <a
                class="fl-link fl-mono"
                [routerLink]="['/management/backup/destinations', r.sourceDestinationId]"
                >{{ r.sourceDestinationId | maskId }}</a
              >
            </fl-kv-item>
            @if (r.targetSelector?.namespaces?.length) {
              <fl-kv-item key="Namespaces" [mono]="true">{{
                r.targetSelector!.namespaces!.join(', ')
              }}</fl-kv-item>
            }
          </fl-key-value>
        </fl-panel>

        <app-backup-progress-modal
          [operationId]="opId()"
          title="Restore in progress"
          (closed)="opId.set(null)"
        />
      } @else if (loaded()) {
        <fl-page-header title="Restore job" [breadcrumb]="crumbs('Not found')" />
        <fl-panel>
          <fl-empty-state title="Restore job not found" body="It may have been removed.">
            <a flButton size="sm" routerLink="/management/backup/restore">Back to restores</a>
          </fl-empty-state>
        </fl-panel>
      } @else {
        <fl-page-header title="Restore job" [breadcrumb]="crumbs('Loading')" />
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      }
    </div>
  `,
})
export class RestoreDetailComponent implements OnInit, OnDestroy {
  private readonly backup = inject(BackupService);
  private readonly route = inject(ActivatedRoute);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly job = signal<RestoreJob | null>(null);
  protected readonly loaded = signal(false);
  protected readonly opId = signal<string | null>(null);

  protected readonly target = restoreTargetLabel;
  protected readonly local = formatLocalDateTime;
  protected readonly utc = formatUtcDateTime;

  protected crumbs(last: string): readonly Crumb[] {
    return [
      { label: 'Backups', link: '/management/backup' },
      { label: 'Restores', link: '/management/backup/restore' },
      { label: last },
    ];
  }

  private readonly surfaceRevision = new RestoreDetailSurfaceRevision();

  readonly surface = computed(() => {
    const input: RestoreDetailSurfaceInput = { job: this.job() };
    const content = presentedContent(input);
    if (!content) return null;
    return buildRestoreDetailSurface(input, {
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
      const r = await this.backup.getRestoreJob(id);
      this.job.set(r);
      this.loaded.set(true);
      if (
        r?.infrastructureOperationId &&
        this.backup.activeOperations()[r.infrastructureOperationId]
      ) {
        this.opId.set(r.infrastructureOperationId);
      }
    })();
  }
}
