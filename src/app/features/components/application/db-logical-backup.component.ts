import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideDatabase,
  lucideDownload,
  lucideLoader,
  lucideTriangleAlert,
  lucideUpload,
} from '@ng-icons/lucide';
import { DbBackupInfo, DbBackupService } from '../../service/db-backup.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

/**
 * Logical (engine-native) database backup/restore for the snapshots tab. Renders only for
 * supported DB apps (the backend `info` reports the engine); non-DB apps stay hidden. The dump
 * is a portable SQL/RDB file (download); restore streams a dump back in (destructive, confirmed).
 * Complements the volume snapshots below it. Low-coupling — drop-in via `[appId]`.
 */
@Component({
  selector: 'app-db-logical-backup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideDatabase,
      lucideDownload,
      lucideLoader,
      lucideTriangleAlert,
      lucideUpload,
    }),
  ],
  template: `
    @if (info(); as i) {
      @if (i.supported) {
        <div class="rounded-lg border border-border bg-card p-4">
          <div class="flex items-start gap-2">
            <ng-icon name="lucideDatabase" class="mt-0.5 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold">
                Logical backup
                <span class="font-normal text-muted-foreground">· {{ i.engine }} · {{ i.format }}</span>
              </h3>
              <p class="mt-0.5 text-sm text-muted-foreground">
                A portable engine-native dump{{ i.database ? ' of "' + i.database + '"' : '' }} — restore it here, on
                another Flui database, or anywhere. Complements the volume snapshots below.
              </p>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  (click)="download()"
                  [disabled]="downloading()"
                  class="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <ng-icon [name]="downloading() ? 'lucideLoader' : 'lucideDownload'" class="h-4 w-4" [class.animate-spin]="downloading()" />
                  {{ downloading() ? 'Dumping…' : 'Download dump' }}
                </button>

                @if (i.restoreSupported) {
                  <input #fileInput type="file" class="hidden" (change)="onFile($event)" />
                  <button
                    type="button"
                    (click)="fileInput.click()"
                    [disabled]="restoring()"
                    class="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <ng-icon [name]="restoring() ? 'lucideLoader' : 'lucideUpload'" class="h-4 w-4" [class.animate-spin]="restoring()" />
                    {{ restoring() ? 'Restoring…' : 'Restore from dump…' }}
                  </button>
                } @else {
                  <span class="text-xs text-muted-foreground">Restore via a volume snapshot.</span>
                }
              </div>

              @if (ok(); as m) {
                <p class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{{ m }}</p>
              }
              @if (error(); as e) {
                <p class="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5" /> {{ e }}
                </p>
              }
            </div>
          </div>
        </div>

        <app-confirmation-dialog
          #restoreDialog
          title="Restore database"
          [message]="
            'Restore “' + (pendingFile()?.name ?? '') + '” into this database? ' +
            'This runs the dump against the live database and OVERWRITES existing data.'
          "
          confirmText="Restore"
          variant="danger"
          (confirmed)="confirmRestore()"
          (cancelled)="pendingFile.set(null)"
        />
      }
    }
  `,
})
export class DbLogicalBackupComponent {
  private readonly svc = inject(DbBackupService);

  readonly appId = input<string | null>(null);

  readonly info = signal<DbBackupInfo | null>(null);
  readonly downloading = signal(false);
  readonly restoring = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);
  readonly pendingFile = signal<File | null>(null);

  @ViewChild('restoreDialog') private readonly restoreDialog?: ConfirmationDialogComponent;

  constructor() {
    effect(() => {
      const id = this.appId();
      this.info.set(null);
      this.error.set(null);
      this.ok.set(null);
      if (!id) return;
      // info 4xx (not a DB / unsupported) → leave hidden.
      this.svc.info(id).subscribe({
        next: (i) => this.info.set(i),
        error: () => this.info.set(null),
      });
    });
  }

  download(): void {
    const id = this.appId();
    const i = this.info();
    if (!id || !i) return;
    this.downloading.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.svc.dump(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = i.suggestedFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: (e) => {
        this.error.set(this.msg(e));
        this.downloading.set(false);
      },
    });
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    this.pendingFile.set(file);
    this.restoreDialog?.open();
  }

  confirmRestore(): void {
    const id = this.appId();
    const file = this.pendingFile();
    if (!id || !file) return;
    this.restoreDialog?.setProcessing(true);
    this.restoring.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.svc.restore(id, file).subscribe({
      next: () => {
        this.restoreDialog?.close();
        this.pendingFile.set(null);
        this.restoring.set(false);
        this.ok.set('Restore complete.');
      },
      error: (e) => {
        this.restoreDialog?.setProcessing(false);
        this.restoreDialog?.close();
        this.pendingFile.set(null);
        this.restoring.set(false);
        this.error.set(this.msg(e));
      },
    });
  }

  private msg(e: unknown): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message ?? err?.message ?? 'Request failed';
  }
}
