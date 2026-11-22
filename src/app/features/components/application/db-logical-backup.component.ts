import { Component, effect, inject, input, signal, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideUpload } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { DbBackupInfo, DbBackupService } from '../../service/db-backup.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';

/**
 * Logical (engine-native) database backup/restore for the snapshots tab. Renders only for
 * supported DB apps (the backend `info` reports the engine); non-DB apps stay hidden. The dump
 * is a portable SQL/RDB file (download); restore streams a dump back in (destructive, confirmed).
 * Complements the volume copies below it. Low-coupling — drop-in via `[appId]`.
 */
@Component({
  selector: 'app-db-logical-backup',
  imports: [ConfirmationDialogComponent, FlPanel, FlAlert, FlStatus, FlButton, FlIcon, FlSpinner],
  providers: [provideIcons({ lucideDownload, lucideUpload })],
  host: { class: 'block' },
  template: `
    @if (info(); as i) {
      @if (i.supported) {
        <fl-panel title="Logical backup" data-testid="db-logical-backup">
          <span panelActions class="text-fl-body-sm text-fl-ink-muted"
            >{{ i.engine }} · {{ i.format }}</span
          >
          <div class="flex flex-col gap-3">
            <p class="text-fl-body-sm text-fl-ink-muted">
              A portable engine-native dump{{
                i.database ? ' of database “' + i.database + '”' : ''
              }}
              — restore it here, on another Flui database, or anywhere. Complements the volume
              copies below.
            </p>

            <div class="fl-row">
              <button
                flButton
                size="sm"
                type="button"
                (click)="download()"
                [disabled]="downloading()"
              >
                @if (downloading()) {
                  <fl-spinner label="Dumping" />
                } @else {
                  <fl-icon name="lucideDownload" [size]="14" />
                }
                {{ downloading() ? 'Dumping…' : 'Download dump' }}
              </button>

              @if (i.restoreSupported) {
                <input #fileInput type="file" class="hidden" (change)="onFile($event)" />
                <button
                  flButton
                  size="sm"
                  type="button"
                  class="text-fl-danger"
                  (click)="fileInput.click()"
                  [disabled]="restoring()"
                >
                  @if (restoring()) {
                    <fl-spinner label="Restoring" />
                  } @else {
                    <fl-icon name="lucideUpload" [size]="14" />
                  }
                  {{ restoring() ? 'Restoring…' : 'Restore from dump…' }}
                </button>
              } @else {
                <span class="text-fl-body-sm text-fl-ink-muted">Restore via a volume copy.</span>
              }
            </div>

            @if (ok(); as m) {
              <fl-status tone="success" [label]="m" />
            }
            @if (error(); as e) {
              <fl-alert tone="error" title="Request failed">{{ e }}</fl-alert>
            }
          </div>
        </fl-panel>

        <app-confirmation-dialog
          #restoreDialog
          title="Restore database"
          [message]="
            'Restore “' +
            (pendingFile()?.name ?? '') +
            '” into this database? ' +
            'This runs the dump against the live database and overwrites existing data.'
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

  private readonly restoreDialog = viewChild<ConfirmationDialogComponent>('restoreDialog');

  constructor() {
    effect(() => {
      const id = this.appId();
      this.info.set(null);
      this.error.set(null);
      this.ok.set(null);
      if (!id) return;
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
    this.restoreDialog()?.open();
  }

  confirmRestore(): void {
    const id = this.appId();
    const file = this.pendingFile();
    if (!id || !file) return;
    this.restoreDialog()?.setProcessing(true);
    this.restoring.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.svc.restore(id, file).subscribe({
      next: () => {
        this.restoreDialog()?.close();
        this.pendingFile.set(null);
        this.restoring.set(false);
        this.ok.set('Restore complete.');
      },
      error: (e) => {
        this.restoreDialog()?.setProcessing(false);
        this.restoreDialog()?.close();
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
