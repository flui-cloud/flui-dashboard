import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCamera,
  lucideCircleAlert,
  lucideLoader,
  lucidePlus,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideTrash2,
} from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationSnapshotsService } from '../../service/application-snapshots.service';
import { DbLogicalBackupComponent } from './db-logical-backup.component';
import { DbPitrComponent } from './db-pitr.component';
import { SnapshotCreateDialogComponent } from './snapshot-create-dialog.component';
import { SnapshotDeleteDialogComponent } from './snapshot-delete-dialog.component';
import { SnapshotRestoreDialogComponent } from './snapshot-restore-dialog.component';
import {
  formatDate,
  kindBadgeClass,
  kindLabel,
  kindTooltip,
  sizeLine,
  sizeSubline,
  statusClass,
  statusLabel,
} from './snapshot-format';
import {
  ApplicationSnapshot,
  CreateSnapshotRequest,
  SnapshotStatus,
  SpareVolume,
  snapshotStatus,
} from '../../model/volume-management.models';
import { databaseEngineOf } from '../../model/db-engine';
import { AppBackupProtectionComponent } from './app-backup-protection.component';
import { AppVolumeBackupsComponent } from './app-volume-backups.component';

type StatusFilter = 'all' | SnapshotStatus;

@Component({
  selector: 'app-snapshots-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgIconComponent,
    DbLogicalBackupComponent,
    DbPitrComponent,
    SnapshotCreateDialogComponent,
    SnapshotDeleteDialogComponent,
    SnapshotRestoreDialogComponent,
    AppBackupProtectionComponent,
    AppVolumeBackupsComponent,
  ],
  providers: [
    provideIcons({
      lucideCamera,
      lucidePlus,
      lucideRefreshCw,
      lucideTrash2,
      lucideLoader,
      lucideCircleAlert,
      lucideRotateCcw,
    }),
  ],
  template: `
    <div class="space-y-6">
      <app-backup-protection
        [appId]="appId()"
        [appSlug]="appService.selectedApplication()?.slug ?? ''"
        [clusterId]="appService.selectedApplication()?.clusterId ?? ''"
        [database]="isDatabase()"
        [postgres]="isPostgres()"
        [hasData]="!noVolume()"
        (backedUp)="volumeBackups.load()"
      />

      @if (isDatabase()) {
        <app-db-logical-backup [appId]="appId()" />
        <app-db-pitr [appId]="appId()" />
      }

      <app-volume-backups
        #volumeBackups
        [appId]="appId()"
        (restoredHere)="reloadSpare()"
      />

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <ng-icon
              name="lucideCamera"
              class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
            />
            Volume copies
          </h2>
          <p class="text-sm text-muted-foreground mt-0.5">
            A file copy of this app's volume, taken as it is unless the app was
            stopped first. These live on the same disk as the app, so deleting
            the app deletes them too — and they cost storage while they exist.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <select
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
            class="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All</option>
            <option value="READY">Ready</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="DELETING">Deleting</option>
          </select>
          <button
            (click)="refresh()"
            [disabled]="isLoading()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="isLoading()"
            />
            Refresh
          </button>
          @if (snapshotCapability()?.supported) {
            <button
              (click)="openCreateDialog()"
              [disabled]="!appId() || creating()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
              Take a copy
            </button>
          }
        </div>
      </div>

      @if (refusal(); as r) {
        <div
          class="card-surface p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 space-y-3"
        >
          <div class="flex items-start gap-3">
            <ng-icon
              name="lucideCircleAlert"
              class="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5"
            />
            <p class="text-sm text-amber-800 dark:text-amber-200">
              {{ r.message }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2 pl-8">
            @if (r.options.includes('pause')) {
              <button
                (click)="retryRefused({ pause: true })"
                [disabled]="creating()"
                class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Stop, copy and restart
              </button>
            }
            @if (r.options.includes('allowInconsistent')) {
              <button
                (click)="retryRefused({ allowInconsistent: true })"
                [disabled]="creating()"
                class="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
              >
                Copy it as it is
              </button>
            }
            <button
              (click)="dismissRefusal()"
              class="px-3 py-1.5 text-xs rounded-md hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Error -->
      @if (errorMessage()) {
        <div
          class="card-surface p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
        >
          <div class="flex items-start gap-3">
            <ng-icon
              name="lucideCircleAlert"
              class="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5"
            />
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ errorMessage() }}
            </p>
          </div>
        </div>
      } @else if (snapshotCapability()?.supported === false) {
        <div
          class="card-surface p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
        >
          <div class="flex items-start gap-3">
            <ng-icon
              name="lucideCircleAlert"
              class="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5"
            />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
                {{
                  noVolume()
                    ? 'This application has no volume to copy'
                    : 'Volume copies are not available on this cluster'
                }}
              </p>
              <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {{ snapshotCapability()?.reason }}
              </p>
            </div>
          </div>
        </div>
      } @else if (isLoading() && snapshots().length === 0) {
        <div class="animate-pulse space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton h-12 rounded-lg"></div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <!-- Empty -->
        <div class="card-inner p-8 text-center">
          <ng-icon
            name="lucideCamera"
            class="h-10 w-10 text-muted-foreground mx-auto mb-3"
          />
          <p class="text-sm font-medium">
            @if (filter() === 'all') {
              No copies yet
            } @else {
              No copies match the selected filter
            }
          </p>
          @if (filter() === 'all') {
            <p class="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Take a copy to keep this volume's contents as they are now. Each
              copy is a full second copy of the data, on the same storage the
              application uses.
            </p>
          }
        </div>
      } @else {
        <div class="card-inner overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-left text-muted-foreground border-b border-border"
              >
                <th class="px-4 py-3 font-normal">Created</th>
                <th class="px-4 py-3 font-normal">Volume</th>
                <th class="px-4 py-3 font-normal">Type</th>
                <th class="px-4 py-3 font-normal">Status</th>
                <th class="px-4 py-3 font-normal text-right">Size</th>
                <th class="px-4 py-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              @for (snap of filtered(); track snap.exportId) {
                @let st = derivedStatus(snap);
                <tr
                  class="border-b border-border/50 last:border-0 hover:bg-muted/30"
                >
                  <td
                    class="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap"
                  >
                    {{ formatDate(snap.createdAt) }}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs">
                    {{ snap.sourcePvcName || '—' }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      [class]="kindBadgeClass(snap)"
                      [title]="kindTooltip(snap)"
                    >
                      {{ kindLabel(snap) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="text-xs flex items-center gap-1.5"
                      [class]="statusClass(st)"
                    >
                      @if (st === 'PENDING' || st === 'DELETING') {
                        <ng-icon
                          name="lucideLoader"
                          class="h-3 w-3 animate-spin"
                        />
                      }
                      {{ statusLabel(snap) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <div class="text-sm">{{ sizeLine(snap) }}</div>
                    @if (sizeSubline(snap); as sub) {
                      <div class="text-[11px] text-muted-foreground">
                        {{ sub }}
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="inline-flex items-center gap-1">
                      <button
                        (click)="confirmRestore(snap)"
                        [disabled]="
                          !snap.ready ||
                          st === 'DELETING' ||
                          isRestoring(snap.exportId)
                        "
                        class="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-50"
                        title="Restore snapshot"
                      >
                        @if (isRestoring(snap.exportId)) {
                          <ng-icon
                            name="lucideLoader"
                            class="h-3.5 w-3.5 animate-spin"
                          />
                        } @else {
                          <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" />
                        }
                      </button>
                      <button
                        (click)="confirmDelete(snap)"
                        [disabled]="
                          st === 'DELETING' || isDeleting(snap.exportId)
                        "
                        class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete snapshot"
                      >
                        <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (spare().length) {
        <div class="space-y-2">
          <h3 class="text-sm font-semibold">Restored and previous volumes</h3>
          <p class="text-xs text-muted-foreground">
            Full volumes this application does not run on, paid for while they
            exist.
          </p>
          <div class="card-inner divide-y divide-border/50">
            @for (v of spare(); track v.name) {
              <div
                class="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <div class="min-w-0">
                  <div class="font-mono text-xs truncate">{{ v.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{
                      v.kind === 'previous'
                        ? 'What the application used before a restore'
                        : 'Restored from a copy, never put in use'
                    }}
                    · {{ v.size || '—' }} · {{ formatDate(v.createdAt ?? '') }}
                  </div>
                </div>
                <div class="flex shrink-0 gap-2">
                  <button
                    (click)="useSpare(v)"
                    [disabled]="v.inUse || restoring()"
                    class="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
                  >
                    Use this
                  </button>
                  <button
                    (click)="deleteSpare(v.name)"
                    [disabled]="v.inUse"
                    class="px-2.5 py-1 text-xs rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

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
      [deleting]="
        pendingDelete() ? isDeleting(pendingDelete()!.exportId) : false
      "
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
    () =>
      databaseEngineOf(this.appService.selectedApplication() as never) ===
      'postgres',
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

  readonly filter = signal<StatusFilter>('all');
  readonly createOpen = signal(false);
  readonly pendingDelete = signal<ApplicationSnapshot | null>(null);
  readonly pendingRestore = signal<ApplicationSnapshot | null>(null);
  readonly restoring = signal(false);
  readonly restoringSnapshotId = signal<string | null>(null);

  protected readonly formatDate = formatDate;
  protected readonly kindLabel = kindLabel;
  protected readonly kindTooltip = kindTooltip;
  protected readonly kindBadgeClass = kindBadgeClass;
  protected readonly statusLabel = statusLabel;
  protected readonly sizeLine = sizeLine;
  protected readonly sizeSubline = sizeSubline;
  protected readonly statusClass = statusClass;
  protected readonly derivedStatus = snapshotStatus;

  readonly filtered = computed(() => {
    const f = this.filter();
    const list = this.snapshots();
    return f === 'all' ? list : list.filter((s) => snapshotStatus(s) === f);
  });

  readonly appId = (): string | null =>
    this.appService.selectedApplication()?.id ?? null;

  ngOnInit(): void {
    void (async () => {
      const id = this.appId();
      if (id) {
        await this.snapshotsService.loadForApp(id);
        await this.snapshotsService.loadSpare(id);
      }
    })();
  }

  async retryRefused(extra: {
    pause?: boolean;
    allowInconsistent?: boolean;
  }): Promise<void> {
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
        await this.snapshotsService.swap(
          id,
          snap.sourcePvcName ?? 'data',
          result.newPvcName,
        );
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
