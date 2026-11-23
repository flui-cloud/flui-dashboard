import { Component, OnInit, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { CacheConsoleStateService } from './cache-console-state.service';
import { CacheLookupResultComponent } from './cache-lookup-result.component';
import { StoreConsoleHeader } from './store-console-header';
import { bytes, hitRatio, uptime } from './cache-format';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlMetric, FlMetricStrip } from '../../../ui/patterns/metric-strip';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-cache-console-page',
  imports: [
    FormsModule,
    ConfirmationDialogComponent,
    CacheLookupResultComponent,
    StoreConsoleHeader,
    FlAlert,
    FlMetric,
    FlMetricStrip,
    FlPanel,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [CacheConsoleStateService, provideIcons({ lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Cache console"
        [appId]="applicationId()"
        [conn]="s.conn()"
        (retry)="s.connect()"
      >
        @if (s.server(); as srv) {
          <span consoleMeta>{{ s.engineLabel() }} {{ srv.version }}</span>
        }
        <ng-container consoleActions>
          @if (!s.readOnly()) {
            <fl-status tone="warning" label="Writes on" />
          }
          <label
            class="fl-check"
            [title]="
              s.readOnly()
                ? 'Writes are blocked'
                : 'Writes are on: set, delete and flush will apply'
            "
          >
            <input
              type="checkbox"
              [checked]="s.readOnly()"
              (change)="s.readOnly.set(!s.readOnly())"
            />
            Read-only
          </label>
          <button
            flButton
            [iconOnly]="true"
            type="button"
            (click)="s.connect()"
            aria-label="Refresh"
            title="Refresh"
          >
            <fl-icon name="lucideRefreshCw" />
          </button>
        </ng-container>
      </app-store-console-header>

      @if (s.conn() === 'connecting') {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      } @else if (s.conn() === 'error') {
        <fl-alert tone="error" title="Could not reach the cache">
          {{ s.errorMsg() || 'Failed to connect.' }}
        </fl-alert>
      } @else {
        @if (s.server(); as srv) {
          <fl-metric-strip>
            <fl-metric label="Uptime" [value]="fmtUptime(srv.uptimeSeconds)" />
            <fl-metric label="Items" [value]="srv.currItems" />
            <fl-metric
              label="Memory"
              [value]="fmtBytes(srv.bytes)"
              [caption]="'of ' + fmtBytes(srv.limitMaxBytes)"
            />
            <fl-metric label="Hit ratio" [value]="fmtHitRatio(srv)" />
            <fl-metric label="Evictions" [value]="srv.evictions" />
            <fl-metric label="Connections" [value]="srv.currConnections" />
          </fl-metric-strip>
        }

        <div class="fl-grid-2">
          <fl-panel title="Look up a key">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <label class="fl-input fl-input--lg min-w-0 flex-1">
                  <input
                    type="text"
                    class="font-mono"
                    [(ngModel)]="s.lookupKey"
                    (keydown.enter)="s.lookup()"
                    aria-label="Key"
                    placeholder="Exact key, e.g. sess:42"
                  />
                </label>
                <button
                  flButton
                  type="button"
                  (click)="s.lookup()"
                  [disabled]="s.getting() || !s.lookupKey.trim()"
                >
                  @if (s.getting()) {
                    <fl-spinner />
                  }
                  Get
                </button>
              </div>
              <p class="m-0 text-fl-caption text-fl-ink-muted">
                Memcached cannot list keys, so fetch by exact key.
              </p>
              @if (s.getError()) {
                <fl-alert tone="error" title="Lookup failed">{{ s.getError() }}</fl-alert>
              }
              <app-cache-lookup-result (removeRequest)="askRemove($event)" />
            </div>
          </fl-panel>

          <fl-panel title="Set a value">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <label class="fl-input fl-input--lg min-w-0 flex-1">
                  <input
                    type="text"
                    class="font-mono"
                    [(ngModel)]="s.setKey"
                    aria-label="Key"
                    placeholder="Key"
                  />
                </label>
                <label class="fl-input fl-input--lg w-32">
                  <input
                    type="number"
                    class="fl-num font-mono"
                    [(ngModel)]="s.setTtl"
                    min="0"
                    aria-label="TTL in seconds, 0 for no expiry"
                    placeholder="TTL s (0 = none)"
                  />
                </label>
              </div>
              <textarea
                class="fl-textarea font-mono text-fl-mono-sm"
                [(ngModel)]="s.setValue"
                rows="3"
                aria-label="Value"
                placeholder="Value (text or JSON)"
              ></textarea>
              <div class="fl-row">
                <button
                  flButton="primary"
                  size="sm"
                  type="button"
                  (click)="s.store()"
                  [disabled]="s.setting() || s.readOnly() || !s.setKey.trim()"
                >
                  @if (s.setting()) {
                    <fl-spinner />
                  }
                  Set
                </button>
                @if (s.readOnly()) {
                  <span class="text-fl-caption text-fl-ink-muted">Clear read-only to write.</span>
                }
                @if (s.setOk()) {
                  <fl-status tone="success" label="Stored" />
                }
              </div>
              @if (s.setError()) {
                <fl-alert tone="error" title="Could not store the value">{{
                  s.setError()
                }}</fl-alert>
              }
            </div>
          </fl-panel>
        </div>

        <fl-panel title="Flush the cache">
          <button
            panelActions
            flButton="danger"
            size="sm"
            type="button"
            (click)="askFlush()"
            [disabled]="s.readOnly() || s.flushing()"
          >
            @if (s.flushing()) {
              <fl-spinner />
            }
            Flush all
          </button>
          <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
            Remove every entry. This cannot be undone.
          </p>
        </fl-panel>
      }

      <app-confirmation-dialog
        #flushDialog
        title="Flush the cache"
        message="Remove every entry from this cache? This cannot be undone."
        confirmText="Flush all"
        variant="danger"
        (confirmed)="s.confirmFlush(flushDialog)"
      />

      <app-confirmation-dialog
        #removeDialog
        title="Delete key"
        [message]="'Delete key “' + (s.pendingRemove() ?? '') + '”? This cannot be undone.'"
        confirmText="Delete"
        variant="danger"
        (confirmed)="s.confirmRemove(removeDialog)"
        (cancelled)="s.pendingRemove.set(null)"
      />
    </div>
  `,
})
export class CacheConsolePageComponent implements OnInit {
  protected readonly s = inject(CacheConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  private readonly flushDialog = viewChild<ConfirmationDialogComponent>('flushDialog');
  private readonly removeDialog = viewChild<ConfirmationDialogComponent>('removeDialog');

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }

  protected askRemove(key: string): void {
    this.s.pendingRemove.set(key);
    this.removeDialog()?.open();
  }

  protected askFlush(): void {
    this.flushDialog()?.open();
  }

  protected fmtUptime(sec: number): string {
    return uptime(sec);
  }

  protected fmtBytes(n: number): string {
    return bytes(n);
  }

  protected fmtHitRatio(srv: Parameters<typeof hitRatio>[0]): string {
    return hitRatio(srv);
  }
}
