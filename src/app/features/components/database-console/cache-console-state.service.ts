import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CacheConsoleService } from '../../service/cache-console.service';
import {
  CacheEntry,
  CacheServerInfo,
} from '../../model/cache-console.models';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { consoleError } from './cache-format';

type ConnState = 'connecting' | 'connected' | 'error';

@Injectable()
export class CacheConsoleStateService {
  private readonly api = inject(CacheConsoleService);
  private readonly router = inject(Router);

  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly server = signal<CacheServerInfo | null>(null);
  readonly engineLabel = signal('Memcached');
  readonly readOnly = signal(true);

  lookupKey = '';
  readonly getting = signal(false);
  readonly looked = signal(false);
  readonly entry = signal<CacheEntry | null>(null);
  readonly getError = signal<string | null>(null);
  readonly deleting = signal(false);

  setKey = '';
  setValue = '';
  setTtl: number | null = null;
  readonly setting = signal(false);
  readonly setOk = signal(false);
  readonly setError = signal<string | null>(null);

  readonly flushing = signal(false);
  readonly pendingRemove = signal<string | null>(null);

  init(): void {
    const id = this.appId();
    if (id) {
      this.api.getConnectionInfo(id).subscribe({
        next: (info) => this.engineLabel.set(info.label),
        error: () => {
          /* keep default label */
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
      },
      error: (e) => {
        this.errorMsg.set(consoleError(e));
        this.conn.set('error');
      },
    });
  }

  private refreshStats(): void {
    const id = this.appId();
    if (!id) return;
    this.api.getServerInfo(id).subscribe({ next: (s) => this.server.set(s) });
  }

  lookup(): void {
    const id = this.appId();
    const key = this.lookupKey.trim();
    if (!id || !key) return;
    this.getting.set(true);
    this.getError.set(null);
    this.api.get(id, key).subscribe({
      next: (r) => {
        this.entry.set(r.entry);
        this.looked.set(true);
        this.getting.set(false);
      },
      error: (e) => {
        this.getError.set(consoleError(e));
        this.getting.set(false);
      },
    });
  }

  store(): void {
    const id = this.appId();
    const key = this.setKey.trim();
    if (!id || !key) return;
    this.setting.set(true);
    this.setOk.set(false);
    this.setError.set(null);
    this.api
      .set(id, {
        key,
        value: this.setValue,
        ttlSeconds: this.setTtl ?? 0,
        readOnly: this.readOnly(),
      })
      .subscribe({
        next: () => {
          this.setOk.set(true);
          this.setting.set(false);
          this.refreshStats();
          if (this.lookupKey.trim() === key) this.lookup();
          setTimeout(() => this.setOk.set(false), 2500);
        },
        error: (e) => {
          this.setError.set(consoleError(e));
          this.setting.set(false);
        },
      });
  }

  confirmRemove(dialog?: ConfirmationDialogComponent): void {
    const id = this.appId();
    const key = this.pendingRemove();
    if (!id || !key) return;
    dialog?.setProcessing(true);
    this.deleting.set(true);
    this.api.delete(id, { key, readOnly: this.readOnly() }).subscribe({
      next: () => {
        dialog?.close();
        this.pendingRemove.set(null);
        this.deleting.set(false);
        this.entry.set(null);
        this.refreshStats();
      },
      error: (e) => {
        dialog?.setProcessing(false);
        dialog?.close();
        this.pendingRemove.set(null);
        this.getError.set(consoleError(e));
        this.deleting.set(false);
      },
    });
  }

  confirmFlush(dialog?: ConfirmationDialogComponent): void {
    const id = this.appId();
    if (!id) return;
    dialog?.setProcessing(true);
    this.flushing.set(true);
    this.api.flush(id, this.readOnly()).subscribe({
      next: () => {
        dialog?.close();
        this.flushing.set(false);
        this.entry.set(null);
        this.refreshStats();
      },
      error: (e) => {
        dialog?.setProcessing(false);
        dialog?.close();
        this.flushing.set(false);
        this.getError.set(consoleError(e));
      },
    });
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
