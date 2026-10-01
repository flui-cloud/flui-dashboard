import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideArchive,
  lucideCircleAlert,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { VolumeBackupsService } from '../../service/volume-backups.service';
import {
  VolumeBackup,
  offClusterBackups,
} from '../../model/volume-backup.models';
import { AssistantOperationProgressComponent } from '../assistant/assistant-operation-progress.component';
import {
  RestoreTarget,
  VolumeBackupBrowserComponent,
  VolumeRestoreStarted,
} from './volume-backup-browser.component';
import { VolumeBackupsTableComponent } from './volume-backups-table.component';
import { VolumeBackupRestoreDialogComponent } from './volume-backup-restore-dialog.component';
import { VolumeBackupDeleteDialogComponent } from './volume-backup-delete-dialog.component';

interface RunningOperation extends VolumeRestoreStarted {
  kind: 'restore' | 'delete';
  backupId: string;
}

/**
 * Volume backups in backup storage for one application: the list, a file
 * browser for one of them, whole and partial restores, and delete.
 */
@Component({
  selector: 'app-volume-backups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIconComponent,
    VolumeBackupBrowserComponent,
    AssistantOperationProgressComponent,
    VolumeBackupsTableComponent,
    VolumeBackupRestoreDialogComponent,
    VolumeBackupDeleteDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideArchive,
      lucideCircleAlert,
      lucideRefreshCw,
    }),
  ],
  template: `
    @if (backups().length || error() || operations().length) {
      <section class="space-y-3" data-testid="volume-backups">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <ng-icon
                name="lucideArchive"
                class="h-5 w-5 text-indigo-600 dark:text-indigo-400"
              />
              Volume backups
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              Encrypted copies of this app's volumes in backup storage.
              <button
                (click)="showHelp.set(!showHelp())"
                class="underline-offset-2 hover:underline"
              >
                {{ showHelp() ? 'Less' : 'More' }}
              </button>
            </p>
            @if (showHelp()) {
              <p class="text-xs text-muted-foreground mt-1 max-w-2xl">
                Each backup stores only what changed since the one before, so
                "Added" is what it cost in storage and "Size" is what a restore
                writes back. A whole restore lands in a new volume beside the
                app and leaves the running app alone; you switch to it when
                ready. Scheduled backups follow the policy's retention; manual
                ones stay until you delete them.
              </p>
            }
          </div>
          <button
            (click)="load()"
            [disabled]="loading()"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5"
              [class.animate-spin]="loading()"
            />
            Refresh
          </button>
        </div>

        @if (error(); as e) {
          <p class="flex items-center gap-1.5 text-sm text-red-600">
            <ng-icon name="lucideCircleAlert" class="h-4 w-4" /> {{ e }}
          </p>
        }

        @for (op of operations(); track op.operationId) {
          <app-assistant-operation-progress
            [operationId]="op.operationId"
            [label]="op.label"
            (settled)="onSettled(op, $event)"
          />
        }

        @if (backups().length) {
          <app-volume-backups-table
            [backups]="backups()"
            [browsingId]="browsing()?.id ?? null"
            [busyIds]="busyIds()"
            [deletingIds]="deletingIds()"
            (browse)="browse($event)"
            (restore)="askRestore($event)"
            (remove)="askDelete($event)"
          />
        }

        @if (browsing(); as b) {
          <app-volume-backup-browser
            [appId]="appId()!"
            [backup]="b"
            [targets]="targets()"
            (started)="track($event, 'restore', b.id)"
            (closed)="browsing.set(null)"
          />
        }
      </section>
    }

    @if (pendingRestore(); as b) {
      <app-volume-backup-restore-dialog
        [backup]="b"
        [targets]="targets()"
        [working]="working()"
        [error]="dialogError()"
        (confirm)="restoreWhole($event)"
        (dismissed)="closeRestore()"
      />
    }

    @if (pendingDelete(); as b) {
      <app-volume-backup-delete-dialog
        [backup]="b"
        [working]="working()"
        [error]="dialogError()"
        (confirm)="deleteBackup()"
        (dismissed)="closeDelete()"
      />
    }
  `,
})
export class AppVolumeBackupsComponent {
  private readonly api = inject(VolumeBackupsService);
  private readonly appService = inject(ApplicationService);

  readonly appId = input<string | null>(null);
  /** A restore into this app finished: its restored volumes changed. */
  readonly restoredHere = output<void>();

  protected readonly all = signal<VolumeBackup[]>([]);
  protected readonly backups = computed(() => offClusterBackups(this.all()));
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showHelp = signal(false);
  protected readonly browsing = signal<VolumeBackup | null>(null);
  protected readonly pendingRestore = signal<VolumeBackup | null>(null);
  protected readonly pendingDelete = signal<VolumeBackup | null>(null);
  protected readonly working = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly operations = signal<RunningOperation[]>([]);

  protected readonly targets = computed<RestoreTarget[]>(() => {
    const self = this.appId();
    return this.appService
      .applications()
      .filter((a) => a.id !== self && !a.systemProtected)
      .map((a) => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly busyIds = computed(
    () => new Set(this.operations().map((o) => o.backupId)),
  );
  protected readonly deletingIds = computed(
    () =>
      new Set(
        this.operations()
          .filter((o) => o.kind === 'delete')
          .map((o) => o.backupId),
      ),
  );

  constructor() {
    effect(() => {
      const id = this.appId();
      untracked(() => {
        this.browsing.set(null);
        this.operations.set([]);
        this.all.set([]);
        if (id) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    const id = this.appId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.all.set(await this.api.list(id));
    } catch (err) {
      this.error.set(
        this.api.errorMessage(err, 'Could not load the volume backups'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected browse(b: VolumeBackup): void {
    this.browsing.set(this.browsing()?.id === b.id ? null : b);
    this.ensureTargets();
  }

  protected askRestore(b: VolumeBackup): void {
    this.dialogError.set(null);
    this.pendingRestore.set(b);
    this.ensureTargets();
  }

  protected closeRestore(): void {
    if (!this.working()) this.pendingRestore.set(null);
  }

  protected askDelete(b: VolumeBackup): void {
    this.dialogError.set(null);
    this.pendingDelete.set(b);
  }

  protected closeDelete(): void {
    if (!this.working()) this.pendingDelete.set(null);
  }

  protected async restoreWhole(target: string): Promise<void> {
    const id = this.appId();
    const b = this.pendingRestore();
    if (!id || !b) return;
    this.working.set(true);
    this.dialogError.set(null);
    try {
      const res = await this.api.restore(
        id,
        b.id,
        target ? { targetApplicationId: target } : {},
      );
      const name = target
        ? (this.targets().find((t) => t.id === target)?.name ?? 'another app')
        : null;
      this.track(
        {
          operationId: res.operationId,
          label: name
            ? `Restoring into a new volume of ${name}`
            : 'Restoring into a new volume beside the app',
          targetApplicationId: res.targetApplicationId,
        },
        'restore',
        b.id,
      );
      this.pendingRestore.set(null);
    } catch (err) {
      this.dialogError.set(
        this.api.errorMessage(err, 'Could not start the restore'),
      );
    } finally {
      this.working.set(false);
    }
  }

  protected async deleteBackup(): Promise<void> {
    const id = this.appId();
    const b = this.pendingDelete();
    if (!id || !b) return;
    this.working.set(true);
    this.dialogError.set(null);
    try {
      const res = await this.api.remove(id, b.id);
      this.track(
        {
          operationId: res.operationId,
          label: 'Deleting a volume backup',
          targetApplicationId: id,
        },
        'delete',
        b.id,
      );
      if (this.browsing()?.id === b.id) this.browsing.set(null);
      this.pendingDelete.set(null);
    } catch (err) {
      this.dialogError.set(
        this.api.errorMessage(err, 'Could not delete the backup'),
      );
    } finally {
      this.working.set(false);
    }
  }

  protected track(
    started: VolumeRestoreStarted,
    kind: RunningOperation['kind'],
    backupId: string,
  ): void {
    this.operations.update((list) => [
      ...list,
      { ...started, kind, backupId },
    ]);
  }

  protected onSettled(op: RunningOperation, status: string): void {
    if (op.kind === 'delete' && status === 'COMPLETED') {
      this.operations.update((list) =>
        list.filter((o) => o.operationId !== op.operationId),
      );
      void this.load();
      return;
    }
    this.operations.update((list) =>
      list.map((o) =>
        o.operationId === op.operationId ? { ...o, backupId: '' } : o,
      ),
    );
    if (
      op.kind === 'restore' &&
      status === 'COMPLETED' &&
      op.targetApplicationId === this.appId()
    ) {
      this.restoredHere.emit();
    }
  }

  private ensureTargets(): void {
    if (!this.appService.applications().length) {
      void this.appService.loadApplications();
    }
  }
}
