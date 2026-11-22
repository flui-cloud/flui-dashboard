import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideCamera, lucidePlus, lucideRefreshCw } from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationSnapshotsService } from '../../service/application-snapshots.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { DbLogicalBackupComponent } from './db-logical-backup.component';
import { DbPitrComponent } from './db-pitr.component';
import { SnapshotCreateDialogComponent } from './snapshot-create-dialog.component';
import { SnapshotDeleteDialogComponent } from './snapshot-delete-dialog.component';
import { SnapshotRestoreDialogComponent } from './snapshot-restore-dialog.component';
import { SnapshotTable } from './snapshot-table';
import { SpareVolumes } from './spare-volumes';
import {
  ApplicationSnapshot,
  CreateSnapshotRequest,
  SnapshotStatus,
  SpareVolume,
  snapshotStatus,
} from '../../model/volume-management.models';
import { databaseEngineOf } from '../../model/db-engine';
import { AppBackupProtectionComponent, Protection } from './app-backup-protection.component';
import { AppBackupDecisionComponent } from './app-backup-decision.component';
import { AppVolumeBackupsComponent } from './app-volume-backups.component';

type StatusFilter = 'all' | SnapshotStatus;

@Component({
  selector: 'app-snapshots-tab',
  imports: [
    FormsModule,
    FlPanel,
    FlAlert,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    DbLogicalBackupComponent,
    DbPitrComponent,
    SnapshotCreateDialogComponent,
    SnapshotDeleteDialogComponent,
    SnapshotRestoreDialogComponent,
    SnapshotTable,
    SpareVolumes,
    AppBackupProtectionComponent,
    AppBackupDecisionComponent,
    AppVolumeBackupsComponent,
  ],
  providers: [provideIcons({ lucideCamera, lucidePlus, lucideRefreshCw })],
  host: { class: 'fl-stack' },
  template: `
    <app-backup-decision
      [appId]="appId()"
      [protection]="protection()"
      (changed)="backupProtection.reload()"
      (protect)="backupProtection.startProtect()"
    />

    <app-backup-protection
      #backupProtection
      [appId]="appId()"
      [appSlug]="appService.selectedApplication()?.slug ?? ''"
      [clusterId]="appService.selectedApplication()?.clusterId ?? ''"
      [database]="isDatabase()"
      [postgres]="isPostgres()"
      [hasData]="!noVolume()"
      (backedUp)="volumeBackups.load()"
      (loaded)="protection.set($event)"
    />

    @if (isDatabase()) {
      <app-db-logical-backup [appId]="appId()" />
      <app-db-pitr [appId]="appId()" />
    }

    <app-volume-backups #volumeBackups [appId]="appId()" (restoredHere)="reloadSpare()" />

    <fl-panel
      title="Volume copies"
      [count]="snapshots().length || null"
      [flush]="true"
      data-testid="volume-copies"
    >
      <div panelActions class="fl-row">
        <span class="fl-select-wrap">
          <select
            class="fl-select fl-select--sm"
            aria-label="Status"
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
          >
            <option value="all">Status: All</option>
            <option value="READY">Ready</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="DELETING">Deleting</option>
          </select>
        </span>
        <button
          flButton="ghost"
          size="sm"
          type="button"
          (click)="refresh()"
          [disabled]="isLoading()"
        >
          <fl-icon name="lucideRefreshCw" [size]="14" />
          Refresh
        </button>
        @if (snapshotCapability()?.supported) {
          <button
            flButton
            size="sm"
            type="button"
            (click)="openCreateDialog()"
            [disabled]="!appId() || creating()"
          >
            <fl-icon name="lucidePlus" [size]="14" />
            Take a copy
          </button>
        }
      </div>

      <div class="flex flex-col gap-3 p-4">
        <p class="text-fl-body-sm text-fl-ink-muted">
          A file copy of this app's volume, taken as it is unless the app was stopped first. Copies
          live on the same disk as the app, so deleting the app deletes them too, and they cost
          storage while they exist.
        </p>

        @if (refusal(); as r) {
          <fl-alert tone="warning" title="Copy not taken">
            {{ r.message }}
            <ng-container alertActions>
              @if (r.options.includes('pause')) {
                <button
                  flButton
                  size="sm"
                  type="button"
                  (click)="retryRefused({ pause: true })"
                  [disabled]="creating()"
                >
                  Stop, copy and restart
                </button>
              }
              @if (r.options.includes('allowInconsistent')) {
                <button
                  flButton
                  size="sm"
                  type="button"
                  (click)="retryRefused({ allowInconsistent: true })"
                  [disabled]="creating()"
                >
                  Copy it as it is
                </button>
              }
              <button flButton="ghost" size="sm" type="button" (click)="dismissRefusal()">
                Cancel
              </button>
            </ng-container>
          </fl-alert>
        }

        @if (errorMessage()) {
          <fl-alert tone="error" title="Request failed">{{ errorMessage() }}</fl-alert>
        } @else if (snapshotCapability()?.supported === false) {
          <fl-alert
            [tone]="noVolume() ? 'info' : 'warning'"
            [title]="
              noVolume()
                ? 'This application has no volume to copy'
                : 'Volume copies are not available on this cluster'
            "
          >
            {{ snapshotCapability()?.reason }}
          </fl-alert>
        }
      </div>

      @if (!errorMessage() && snapshotCapability()?.supported !== false) {
        @if (isLoading() && snapshots().length === 0) {
          <fl-loading-state [rows]="3" />
        } @else if (filtered().length === 0) {
          <fl-empty-state
            class="border-t border-fl-border"
            icon="lucideCamera"
            [compact]="true"
            [title]="filter() === 'all' ? 'No copies yet' : 'No copies match the selected filter'"
            [body]="
              filter() === 'all'
                ? 'Take a copy to keep this volume as it is now. Each copy is a full second copy of the data, on the same storage the application uses.'
                : undefined
            "
          />
        } @else {
          <app-snapshot-table
            class="border-t border-fl-border"
            [snapshots]="filtered()"
            [restoringId]="restoringSnapshotId()"
            [deletingId]="deletingId()"
            (restore)="confirmRestore($event)"
            (remove)="confirmDelete($event)"
          />
        }
      }
    </fl-panel>

    @if (spare().length) {
      <app-spare-volumes
        [volumes]="spare()"
        [restoring]="restoring()"
        (use)="useSpare($event)"
        (remove)="deleteSpare($event)"
      />
    }

    <app-snapshot-create-dialog
      [open]="createOpen()"
      [creating]="creating()"
      [suggestPause]="isDatabase()"
      [showVolume]="hasSeveralVolumes()"
      (submitRequest)="submitCreate($event)"
      (cancelled)="closeCreateDialog()"
    />

    <app-snapshot-delete-dialog
      [snapshot]="pendingDelete()"
      [deleting]="pendingDelete() ? isDeleting(pendingDelete()!.exportId) : false"
      (execute)="executeDelete()"
      (cancelled)="cancelDelete()"
    />

    <app-snapshot-restore-dialog
      [snapshot]="pendingRestore()"
      [restoring]="restoring()"
      (execute)="executeRestore($event)"
      (cancelled)="cancelRestore()"
    />
  `,
})
export class AppSnapshotsTabComponent implements OnInit, OnDestroy {
  protected readonly appService = inject(ApplicationService);
  private readonly snapshotsService = inject(ApplicationSnapshotsService);

  readonly snapshots = this.snapshotsService.snapshots;
  readonly isLoading = this.snapshotsService.loading;
  readonly creating = this.snapshotsService.creating;
  readonly deletingId = this.snapshotsService.deletingId;
  readonly errorMessage = this.snapshotsService.error;
  readonly snapshotCapability = this.snapshotsService.capability;
  readonly refusal = this.snapshotsService.refusal;
  readonly spare = this.snapshotsService.spare;
  readonly isDatabase = computed(
    () => !!databaseEngineOf(this.appService.selectedApplication() as never),
  );
  readonly isPostgres = computed(
    () => databaseEngineOf(this.appService.selectedApplication() as never) === 'postgres',
  );
  readonly hasSeveralVolumes = computed(
    () =>
      new Set(
        this.snapshots()
          .map((s) => s.sourcePvcName)
          .filter(Boolean),
      ).size > 1,
  );
  readonly noVolume = computed(() =>
    /no persistent volume/i.test(this.snapshotCapability()?.reason ?? ''),
  );

  readonly protection = signal<Protection | null>(null);
  readonly filter = signal<StatusFilter>('all');
  readonly createOpen = signal(false);
  readonly pendingDelete = signal<ApplicationSnapshot | null>(null);
  readonly pendingRestore = signal<ApplicationSnapshot | null>(null);
  readonly restoring = signal(false);
  readonly restoringSnapshotId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.snapshots();
    return f === 'all' ? list : list.filter((s) => snapshotStatus(s) === f);
  });

  readonly appId = (): string | null => this.appService.selectedApplication()?.id ?? null;

  ngOnInit(): void {
    void (async () => {
      const id = this.appId();
      if (id) {
        await this.snapshotsService.loadForApp(id);
        await this.snapshotsService.loadSpare(id);
      }
    })();
  }

  async retryRefused(extra: { pause?: boolean; allowInconsistent?: boolean }): Promise<void> {
    const id = this.appId();
    const refused = this.refusal();
    if (!id || !refused) return;
    await this.snapshotsService.create(id, { ...refused.request, ...extra });
  }

  dismissRefusal(): void {
    this.snapshotsService.clearRefusal();
  }

  async useSpare(spare: SpareVolume): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const name = spare.name;
    if (
      !confirm(
        `Make the application use ${name}? It restarts; what it uses now is kept as a previous volume.`,
      )
    )
      return;
    this.restoring.set(true);
    try {
      await this.snapshotsService.swap(id, spare.replaces ?? 'data', name);
      await this.snapshotsService.loadSpare(id);
    } finally {
      this.restoring.set(false);
    }
  }

  async deleteSpare(name: string): Promise<void> {
    const id = this.appId();
    if (!id) return;
    if (!confirm(`Delete ${name}? Its data cannot be recovered.`)) return;
    await this.snapshotsService.deleteSpare(id, name);
  }

  reloadSpare(): void {
    const id = this.appId();
    if (id) void this.snapshotsService.loadSpare(id);
  }

  ngOnDestroy(): void {
    this.snapshotsService.reset();
  }

  async refresh(): Promise<void> {
    const id = this.appId();
    if (id) {
      await this.snapshotsService.loadForApp(id);
    }
  }

  openCreateDialog(): void {
    this.createOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createOpen.set(false);
  }

  async submitCreate(body: CreateSnapshotRequest): Promise<void> {
    const id = this.appId();
    if (!id) return;
    const result = await this.snapshotsService.create(id, body);
    if (result || this.refusal()) {
      this.closeCreateDialog();
    }
  }

  confirmDelete(snap: ApplicationSnapshot): void {
    this.pendingDelete.set(snap);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  async executeDelete(): Promise<void> {
    const snap = this.pendingDelete();
    const id = this.appId();
    if (!snap || !id) return;
    const ok = await this.snapshotsService.delete(id, snap.exportId);
    if (ok) {
      this.pendingDelete.set(null);
    }
  }

  isDeleting(snapshotId: string): boolean {
    return this.deletingId() === snapshotId;
  }

  isRestoring(snapshotId: string): boolean {
    return this.restoringSnapshotId() === snapshotId;
  }

  confirmRestore(snap: ApplicationSnapshot): void {
    this.pendingRestore.set(snap);
  }

  cancelRestore(): void {
    if (this.restoring()) return;
    this.pendingRestore.set(null);
  }

  async executeRestore(restoreAndSwap: boolean): Promise<void> {
    const snap = this.pendingRestore();
    const id = this.appId();
    if (!snap || !id) return;
    this.restoring.set(true);
    this.restoringSnapshotId.set(snap.exportId);
    try {
      const result = await this.snapshotsService.restore(id, snap.exportId);
      if (!result) return;
      if (restoreAndSwap) {
        await this.snapshotsService.swap(id, snap.sourcePvcName ?? 'data', result.newPvcName);
      }
      this.pendingRestore.set(null);
      await this.snapshotsService.loadForApp(id);
      await this.snapshotsService.loadSpare(id);
    } finally {
      this.restoring.set(false);
      this.restoringSnapshotId.set(null);
    }
  }
}
