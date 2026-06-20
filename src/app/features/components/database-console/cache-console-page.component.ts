import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader,
  lucideLockKeyhole,
  lucideLockKeyholeOpen,
  lucideRotateCcw,
  lucideSearch,
  lucideSave,
  lucideTrash2,
  lucideTriangleAlert,
  lucideZap,
} from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { CacheConsoleStateService } from './cache-console-state.service';
import { CacheLookupResultComponent } from './cache-lookup-result.component';
import { bytes, hitRatio, uptime } from './cache-format';

@Component({
  selector: 'app-cache-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    FormsModule,
    ConfirmationDialogComponent,
    CacheLookupResultComponent,
  ],
  providers: [
    CacheConsoleStateService,
    provideIcons({
      lucideArrowLeft,
      lucideLoader,
      lucideLockKeyhole,
      lucideLockKeyholeOpen,
      lucideRotateCcw,
      lucideSearch,
      lucideSave,
      lucideTrash2,
      lucideTriangleAlert,
      lucideZap,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="s.back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideZap" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">
            Cache Console
            @if (s.server(); as srv) {
              <span class="font-normal text-muted-foreground"
                >· {{ s.engineLabel() }} {{ srv.version }}</span
              >
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            (click)="s.readOnly.set(!s.readOnly())"
            [title]="
              s.readOnly()
                ? 'Read-only: writes are blocked'
                : 'Writes enabled — set, delete and flush will apply'
            "
            class="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs"
            [class.border-border]="s.readOnly()"
            [class.text-muted-foreground]="s.readOnly()"
            [class.border-amber-500]="!s.readOnly()"
            [class.text-amber-600]="!s.readOnly()"
          >
            <ng-icon
              [name]="
                s.readOnly() ? 'lucideLockKeyhole' : 'lucideLockKeyholeOpen'
              "
              class="h-3.5 w-3.5"
            />
            {{ s.readOnly() ? 'Read-only' : 'Writes on' }}
          </button>
          <button
            type="button"
            (click)="s.connect()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      @if (s.conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Connecting…
        </div>
      } @else if (s.conn() === 'error') {
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ s.errorMsg() || 'Failed to connect.' }}</span>
        </div>
      } @else {
        @if (s.server(); as srv) {
          <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Uptime</div>
              <div class="truncate text-sm font-semibold text-foreground">
                {{ fmtUptime(srv.uptimeSeconds) }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Items</div>
              <div class="text-sm font-semibold text-foreground">
                {{ srv.currItems }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Memory</div>
              <div class="text-sm font-semibold text-foreground">
                {{ fmtBytes(srv.bytes) }} / {{ fmtBytes(srv.limitMaxBytes) }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Hit ratio</div>
              <div class="text-sm font-semibold text-foreground">
                {{ fmtHitRatio(srv) }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Evictions</div>
              <div class="text-sm font-semibold text-foreground">
                {{ srv.evictions }}
              </div>
            </div>
            <div class="rounded-md border border-border p-3">
              <div class="text-xs text-muted-foreground">Connections</div>
              <div class="text-sm font-semibold text-foreground">
                {{ srv.currConnections }}
              </div>
            </div>
          </div>
        }

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-md border border-border p-3">
            <div
              class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <ng-icon
                name="lucideSearch"
                class="h-4 w-4 text-muted-foreground"
              />
              Look up a key
            </div>
            <div class="mb-2 flex items-center gap-2">
              <input
                type="text"
                [(ngModel)]="s.lookupKey"
                (keydown.enter)="s.lookup()"
                placeholder="exact key (e.g. sess:42)"
                class="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
              />
              <button
                type="button"
                (click)="s.lookup()"
                [disabled]="s.getting() || !s.lookupKey.trim()"
                class="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                @if (s.getting()) {
                  <ng-icon
                    name="lucideLoader"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                }
                Get
              </button>
            </div>
            <p class="mb-2 text-[11px] text-muted-foreground">
              Memcached can't list keys — fetch by exact key.
            </p>
            @if (s.getError()) {
              <p class="text-xs text-destructive">{{ s.getError() }}</p>
            }
            <app-cache-lookup-result (removeRequest)="askRemove($event)" />
          </div>

          <div class="rounded-md border border-border p-3">
            <div
              class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <ng-icon name="lucideSave" class="h-4 w-4 text-muted-foreground" />
              Set a value
            </div>
            <div class="mb-2 flex items-center gap-2">
              <input
                type="text"
                [(ngModel)]="s.setKey"
                placeholder="key"
                class="h-9 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
              />
              <input
                type="number"
                [(ngModel)]="s.setTtl"
                min="0"
                placeholder="ttl s (0=∞)"
                class="h-9 w-28 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
              />
            </div>
            <textarea
              [(ngModel)]="s.setValue"
              rows="3"
              placeholder="value (text or JSON)"
              class="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            ></textarea>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="s.store()"
                [disabled]="s.setting() || s.readOnly() || !s.setKey.trim()"
                class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                @if (s.setting()) {
                  <ng-icon
                    name="lucideLoader"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                }
                Set
              </button>
              @if (s.readOnly()) {
                <span class="text-xs text-muted-foreground"
                  >Turn off read-only to write.</span
                >
              }
              @if (s.setOk()) {
                <span class="text-xs text-emerald-600 dark:text-emerald-400"
                  >Stored.</span
                >
              }
              @if (s.setError()) {
                <span class="text-xs text-destructive">{{ s.setError() }}</span>
              }
            </div>
          </div>
        </div>

        <div
          class="mt-4 flex items-center gap-3 rounded-md border border-border p-3"
        >
          <ng-icon name="lucideTrash2" class="h-4 w-4 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-foreground">Flush the cache</p>
            <p class="text-xs text-muted-foreground">
              Remove every entry. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            (click)="askFlush()"
            [disabled]="s.readOnly() || s.flushing()"
            class="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            @if (s.flushing()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            }
            Flush all
          </button>
        </div>
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
        [message]="
          'Delete key “' + (s.pendingRemove() ?? '') + '”? This cannot be undone.'
        "
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

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  @ViewChild('flushDialog')
  private readonly flushDialog?: ConfirmationDialogComponent;
  @ViewChild('removeDialog')
  private readonly removeDialog?: ConfirmationDialogComponent;

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }

  protected askRemove(key: string): void {
    this.s.pendingRemove.set(key);
    this.removeDialog?.open();
  }

  protected askFlush(): void {
    this.flushDialog?.open();
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
