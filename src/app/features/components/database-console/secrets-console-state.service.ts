import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SecretsConsoleService } from '../../service/secrets-console.service';
import {
  SecretRead,
  SecretsConnectionInfo,
  SecretsServerInfo,
} from '../../model/secrets-console.models';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { KvRow, consoleError, dataToRows, joinPath } from './secrets-format';

type ConnState = 'connecting' | 'connected' | 'error';

@Injectable()
export class SecretsConsoleStateService {
  private readonly api = inject(SecretsConsoleService);
  private readonly router = inject(Router);
  private readonly maskMode = inject(MaskModeService);
  /** Exposed so the editor can disable reveal/copy affordances while it's on. */
  readonly maskModeOn = this.maskMode.enabled;

  /**
   * A mask-mode toggle must never leave an open secret showing a value
   * fetched under the previous state: the copy paths in
   * `SecretsEditorComponent` read `rows()` live, so refreshing it here is
   * what stops them handing out a stale real value. Skips its own first run.
   */
  constructor() {
    let first = true;
    effect(() => {
      const on = this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      if (!this.editing() || this.isNew()) return;
      // Drop revealed rows synchronously, ahead of the refetch: a row left
      // revealed would keep the pre-toggle value on screen for the round trip.
      if (on) {
        this.revealAll.set(false);
        this.revealedRows.set(new Set());
      }
      const path = this.selectedPath();
      if (!path) return;
      this.refetchSelected(this.viewVersion() ?? undefined);
    });
  }

  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly server = signal<SecretsServerInfo | null>(null);
  readonly engineLabel = signal('OpenBao');
  readonly readOnly = signal(true);

  readonly prefix = signal('');
  readonly entries = signal<{ name: string; isFolder: boolean }[]>([]);
  readonly listing = signal(false);
  readonly navSeq = signal(0);

  readonly selectedPath = signal('');
  readonly selected = signal<SecretRead | null>(null);
  readonly viewVersion = signal<number | null>(null);
  readonly loadingSecret = signal(false);
  readonly editing = signal(false);
  readonly isNew = signal(false);
  readonly rows = signal<KvRow[]>([]);
  readonly newSeq = signal(0);

  readonly saving = signal(false);
  readonly saveOk = signal(false);
  readonly editError = signal<string | null>(null);

  readonly revealAll = signal(false);
  private readonly revealedRows = signal<Set<number>>(new Set());
  readonly copied = signal<string | null>(null);
  readonly bulk = signal(false);

  init(): void {
    const id = this.appId();
    if (id) {
      this.api.getConnectionInfo(id).subscribe({
        next: (info: SecretsConnectionInfo) => this.engineLabel.set(info.label),
        error: () => {
          /* keep default */
        },
      });
    }
    this.connect();
  }

  connect(): void {
    const id = this.appId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getServerInfo(id).subscribe({
      next: (info) => {
        this.server.set(info);
        this.conn.set('connected');
        this.navigate('');
      },
      error: (e) => {
        this.errorMsg.set(consoleError(e));
        this.conn.set('error');
      },
    });
  }

  navigate(prefix: string): void {
    const id = this.appId();
    if (!id) return;
    this.prefix.set(prefix);
    this.navSeq.update((n) => n + 1);
    this.listing.set(true);
    this.api.list(id, prefix).subscribe({
      next: (es) => {
        this.entries.set(es);
        this.listing.set(false);
      },
      error: (e) => {
        this.entries.set([]);
        this.listing.set(false);
        this.editError.set(consoleError(e));
      },
    });
  }

  enterFolder(name: string): void {
    this.navigate(joinPath(this.prefix(), name));
  }

  setRows(data?: Record<string, string>): void {
    this.rows.set(dataToRows(data));
  }

  openSecret(name: string, version?: number): void {
    const id = this.appId();
    const path = joinPath(this.prefix(), name);
    if (!id) return;
    this.editing.set(true);
    this.isNew.set(false);
    this.bulk.set(false);
    this.selectedPath.set(path);
    this.loadingSecret.set(true);
    this.rows.set([]);
    this.saveOk.set(false);
    this.editError.set(null);
    this.revealedRows.set(new Set());
    this.revealAll.set(false);
    this.api.read(id, path, version).subscribe({
      next: (r) => {
        this.selected.set(r.secret);
        this.viewVersion.set(r.secret?.version ?? null);
        this.setRows(r.secret?.data);
        this.loadingSecret.set(false);
      },
      error: (e) => {
        this.editError.set(consoleError(e));
        this.loadingSecret.set(false);
      },
    });
  }

  changeVersion(version: number): void {
    const id = this.appId();
    if (!id) return;
    this.api.read(id, this.selectedPath(), Number(version)).subscribe({
      next: (r) => {
        this.viewVersion.set(Number(version));
        this.setRows(r.secret?.data);
      },
      error: (e) => this.editError.set(consoleError(e)),
    });
  }

  startNew(): void {
    this.editing.set(true);
    this.isNew.set(true);
    this.newSeq.update((n) => n + 1);
    this.bulk.set(false);
    this.selected.set(null);
    this.selectedPath.set('');
    this.rows.set([{ key: '', value: '' }]);
    this.revealedRows.set(new Set([0]));
    this.saveOk.set(false);
    this.editError.set(null);
  }

  addRow(): void {
    this.rows.update((r) => [...r, { key: '', value: '' }]);
  }
  removeRow(index: number): void {
    this.rows.update((r) => r.filter((_, i) => i !== index));
  }

  isRevealed(index: number): boolean {
    return this.revealAll() || this.revealedRows().has(index);
  }
  toggleReveal(index: number): void {
    this.revealedRows.update((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  copy(text: string, tag: string): void {
    void navigator.clipboard?.writeText(text);
    this.copied.set(tag);
    setTimeout(() => {
      if (this.copied() === tag) this.copied.set(null);
    }, 1200);
  }

  save(data: Record<string, string>, newLeaf: string): void {
    const id = this.appId();
    const path = this.isNew()
      ? joinPath(this.prefix(), newLeaf.trim())
      : this.selectedPath();
    if (!id || !path) return;
    this.saving.set(true);
    this.saveOk.set(false);
    this.editError.set(null);
    this.api.write(id, { path, data, readOnly: this.readOnly() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveOk.set(true);
        if (this.isNew()) {
          const parts = path.split('/');
          const leaf = parts.pop() ?? path;
          this.navigate(parts.join('/'));
          this.openSecret(leaf);
        } else {
          this.refetchSelected();
        }
      },
      error: (e) => {
        this.editError.set(consoleError(e));
        this.saving.set(false);
      },
    });
  }

  /** Re-reads the currently open secret — at a given version, or the latest. */
  private refetchSelected(version?: number): void {
    const id = this.appId();
    const path = this.selectedPath();
    if (!id || !path) return;
    this.api.read(id, path, version).subscribe({
      next: (r) => {
        this.selected.set(r.secret);
        this.viewVersion.set(r.secret?.version ?? null);
        this.setRows(r.secret?.data);
      },
      error: (e) => this.editError.set(consoleError(e)),
    });
  }

  undelete(version: number): void {
    const id = this.appId();
    if (!id) return;
    this.api
      .undelete(id, {
        path: this.selectedPath(),
        version,
        readOnly: this.readOnly(),
      })
      .subscribe({
        next: () =>
          this.openSecret(this.selectedPath().split('/').pop() ?? '', version),
        error: (e) => this.editError.set(consoleError(e)),
      });
  }

  removeSecret(destroy: boolean, dialog?: ConfirmationDialogComponent): void {
    const id = this.appId();
    const path = this.selectedPath();
    if (!id || !path) return;
    dialog?.setProcessing(true);
    this.saving.set(true);
    this.editError.set(null);
    this.api.delete(id, { path, destroy, readOnly: this.readOnly() }).subscribe({
      next: () => {
        this.saving.set(false);
        dialog?.close();
        if (destroy) {
          this.editing.set(false);
          this.selected.set(null);
        } else {
          this.openSecret(path.split('/').pop() ?? path);
        }
        this.navigate(this.prefix());
      },
      error: (e) => {
        this.saving.set(false);
        dialog?.setProcessing(false);
        this.editError.set(consoleError(e));
      },
    });
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
