import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideBan,
  lucideCircleAlert,
  lucideLoader,
  lucideRefreshCw,
  lucideUnplug,
} from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import {
  DbPooledClient,
  DbSession,
  DbSessionAction,
  DbSessionsInfo,
  DbSessionsService,
} from '../../service/db-sessions.service';
import { accessOf } from '../../model/app-access';
import { databaseEngineOf } from '../../model/db-engine';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { DisclosureComponent } from '../../../shared/components/disclosure.component';
import { consoleError } from '../database-console/search-format';
import {
  PendingAction,
  confirmCopy,
  formatAge,
  orderByBlocker,
  pooledClientWho,
  poolerSummary,
  stateLabel,
  stateTone,
  summaryLine,
  waitingOn,
  whoOf,
} from './app-sessions-view';

const AUTO_REFRESH_MS = 5000;

@Component({
  selector: 'app-sessions-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, ConfirmationDialogComponent, DisclosureComponent],
  providers: [
    provideIcons({ lucideBan, lucideCircleAlert, lucideLoader, lucideRefreshCw, lucideUnplug }),
  ],
  template: `
    <div class="space-y-4" data-testid="sessions-tab">
      @if (!supported()) {
        <p class="text-sm text-muted-foreground" data-testid="sessions-unsupported">
          Active sessions are shown for managed PostgreSQL databases.
        </p>
      } @else if (!dataAccess()) {
        <p class="text-sm text-muted-foreground">
          Your access to this database does not include its data.
        </p>
      } @else {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm font-medium" data-testid="sessions-summary">
            {{ info() ? summary() : 'Reading sessions…' }}
          </p>
          <div class="flex items-center gap-3">
            <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                [checked]="showIdle()"
                (change)="toggleIdle()"
                data-testid="sessions-show-idle"
              />
              Show idle
            </label>
            <label class="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                [checked]="autoRefresh()"
                (change)="autoRefresh.set(!autoRefresh())"
                data-testid="sessions-auto-refresh"
              />
              Every 5 s
            </label>
            <button
              type="button"
              class="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
              (click)="refresh()"
              [disabled]="loading()"
              data-testid="sessions-refresh"
            >
              <ng-icon
                [name]="loading() ? 'lucideLoader' : 'lucideRefreshCw'"
                class="h-4 w-4"
                [class.animate-spin]="loading()"
              />
              Refresh
            </button>
          </div>
        </div>

        @if (error()) {
          <div
            class="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300"
            data-testid="sessions-error"
          >
            <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5 shrink-0" />
            <span>{{ error() }}</span>
          </div>
        }
        @if (notice()) {
          <p class="text-sm text-emerald-700 dark:text-emerald-400" data-testid="sessions-notice">
            {{ notice() }}
          </p>
        }

        @if (info(); as i) {
          @if (!rows().length) {
            <p class="text-sm text-muted-foreground" data-testid="sessions-empty">
              No session is doing anything right now.
            </p>
          } @else {
            <div class="card-inner overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-muted-foreground border-b border-border">
                    <th class="px-4 py-3 font-normal">Who</th>
                    <th class="px-4 py-3 font-normal">State</th>
                    <th class="px-4 py-3 font-normal">For</th>
                    <th class="px-4 py-3 font-normal">Query</th>
                    <th class="px-4 py-3 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.session.pid) {
                    @let s = row.session;
                    <tr
                      class="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer"
                      [attr.data-testid]="'session-' + s.pid"
                      (click)="toggle(s.pid)"
                    >
                      <td class="px-4 py-3 whitespace-nowrap" [style.padding-left.rem]="1 + row.depth * 1.25">
                        @if (row.depth) {
                          <span class="text-muted-foreground mr-1">└</span>
                        }
                        {{ who(s) }}
                        @if (s.blocks) {
                          <span
                            class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            [attr.data-testid]="'session-blocking-' + s.pid"
                          >
                            blocking {{ s.blocks }}
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        <span class="text-xs px-2 py-0.5 rounded-full" [class]="toneClass(s)">
                          {{ state(s) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                        {{ age(s.xactAgeMs ?? s.stateAgeMs) }}
                      </td>
                      <td class="px-4 py-3 font-mono text-xs max-w-[28rem] truncate" [title]="s.query">
                        {{ s.query || '—' }}
                      </td>
                      <td class="px-4 py-3 text-right whitespace-nowrap" (click)="$event.stopPropagation()">
                        <button
                          type="button"
                          class="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                          [disabled]="!s.actions.cancel || busy() === s.pid"
                          [title]="s.actions.cancel ? 'Cancel query' : (s.actions.reason ?? 'Not available')"
                          [attr.data-testid]="'session-cancel-' + s.pid"
                          (click)="ask(s, 'cancel')"
                        >
                          <ng-icon name="lucideBan" class="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-40"
                          [disabled]="!s.actions.terminate || busy() === s.pid"
                          [title]="s.actions.terminate ? 'Close session' : (s.actions.reason ?? 'Not available')"
                          [attr.data-testid]="'session-terminate-' + s.pid"
                          (click)="ask(s, 'terminate')"
                        >
                          <ng-icon name="lucideUnplug" class="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    @if (expanded() === s.pid) {
                      <tr class="border-b border-border/50 bg-muted/20" [attr.data-testid]="'session-detail-' + s.pid">
                        <td colspan="5" class="px-4 py-3">
                          <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
                            <dt class="text-muted-foreground">Session</dt>
                            <dd class="font-mono">{{ s.pid }}</dd>
                            <dt class="text-muted-foreground">User · database</dt>
                            <dd>{{ s.user }} · {{ s.database }}</dd>
                            @if (s.applicationName) {
                              <dt class="text-muted-foreground">Application name</dt>
                              <dd>{{ s.applicationName }}</dd>
                            }
                            @if (s.clientAddr) {
                              <dt class="text-muted-foreground">Address</dt>
                              <dd class="font-mono">{{ s.clientAddr }}</dd>
                            }
                            @if (waiting(s); as w) {
                              <dt class="text-muted-foreground">Waiting on</dt>
                              <dd>{{ w }}</dd>
                            }
                            <dt class="text-muted-foreground">Transaction open</dt>
                            <dd>{{ age(s.xactAgeMs) }}{{ s.writing ? ' · has written' : '' }}</dd>
                            <dt class="text-muted-foreground">Statement running</dt>
                            <dd>{{ age(s.queryAgeMs) }}</dd>
                            @if (s.actions.reason) {
                              <dt class="text-muted-foreground">Actions</dt>
                              <dd>{{ s.actions.reason }}</dd>
                            }
                            <dt class="text-muted-foreground">Query</dt>
                            <dd class="font-mono whitespace-pre-wrap break-all">{{ s.query || '—' }}</dd>
                          </dl>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            @if (i.truncated) {
              <p class="text-xs text-amber-600">More sessions exist than are listed.</p>
            }
          }

          @if (i.pooler; as p) {
            <app-disclosure label="Pooler" [summary]="poolerLine()" testid="sessions-pooler">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-left text-muted-foreground">
                    <th class="py-1 font-normal">Pool</th>
                    <th class="py-1 font-normal text-right">Clients</th>
                    <th class="py-1 font-normal text-right">Waiting</th>
                    <th class="py-1 font-normal text-right">Servers</th>
                    <th class="py-1 font-normal text-right">Longest wait</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pool of p.pools; track pool.pod + pool.database + pool.user) {
                    <tr>
                      <td class="py-1">{{ pool.database }} · {{ pool.user }}</td>
                      <td class="py-1 text-right tabular-nums">{{ pool.clientsActive }}</td>
                      <td class="py-1 text-right tabular-nums">{{ pool.clientsWaiting }}</td>
                      <td class="py-1 text-right tabular-nums">{{ pool.serversActive }} / {{ pool.serversActive + pool.serversIdle }}</td>
                      <td class="py-1 text-right tabular-nums">{{ age(pool.maxWaitMs) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (p.reason) {
                <p class="mt-2 text-xs text-amber-600" data-testid="sessions-pooler-reason">{{ p.reason }}</p>
              }
              @if (p.clients.length) {
                <table class="mt-3 w-full text-xs">
                  <thead>
                    <tr class="text-left text-muted-foreground">
                      <th class="py-1 font-normal">Pooled client</th>
                      <th class="py-1 font-normal">State</th>
                      <th class="py-1 font-normal text-right">Waiting</th>
                      <th class="py-1 font-normal text-right">Session</th>
                      <th class="py-1 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of p.clients; track c.pod + ':' + c.id) {
                      <tr [attr.data-testid]="'pooled-client-' + c.id">
                        <td class="py-1">{{ clientWho(c) }}</td>
                        <td class="py-1">{{ c.state }}</td>
                        <td class="py-1 text-right tabular-nums">{{ c.waitMs ? age(c.waitMs) : '—' }}</td>
                        <td class="py-1 text-right tabular-nums">{{ c.serverPid ?? '—' }}</td>
                        <td class="py-1 text-right">
                          <button
                            type="button"
                            class="px-2 py-0.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                            [disabled]="!c.canClose || busyClient() === c.pod + ':' + c.id"
                            [attr.data-testid]="'pooled-client-close-' + c.id"
                            (click)="askClient(c)"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </app-disclosure>
          }
          <p class="text-[11px] text-muted-foreground">
            Values in queries are hidden. Read at {{ i.capturedAt }}.
          </p>
        }
      }
    </div>

    <app-confirmation-dialog
      [title]="copy()?.title ?? ''"
      [message]="copy()?.message ?? ''"
      [confirmText]="copy()?.confirmText ?? 'Confirm'"
      cancelText="Keep it"
      [variant]="copy()?.variant ?? 'warning'"
      [details]="copy()?.details ?? []"
      (confirmed)="confirm()"
      (cancelled)="pending.set(null)"
    />
  `,
})
export class AppSessionsTabComponent {
  private readonly appService = inject(ApplicationService);
  private readonly sessionsService = inject(DbSessionsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dialog = viewChild.required(ConfirmationDialogComponent);

  readonly info = signal<DbSessionsInfo | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly showIdle = signal(false);
  readonly autoRefresh = signal(false);
  readonly expanded = signal<number | null>(null);
  readonly busy = signal<number | null>(null);
  readonly busyClient = signal<string | null>(null);
  readonly pending = signal<PendingAction | null>(null);

  private readonly app = computed(() => this.appService.selectedApplication());
  readonly supported = computed(() => databaseEngineOf(this.app()) === 'postgres');
  readonly dataAccess = computed(() => accessOf(this.app())?.dataAccess !== false);
  readonly rows = computed(() => orderByBlocker(this.info()?.sessions ?? []));
  readonly summary = computed(() => {
    const i = this.info();
    return i ? summaryLine(i) : '';
  });
  readonly poolerLine = computed(() => {
    const i = this.info();
    return i ? poolerSummary(i) : '';
  });
  readonly copy = computed(() => confirmCopy(this.pending()));

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const id = this.app()?.id ?? null;
      if (!id || !this.supported() || !this.dataAccess() || id === this.loadedFor) return;
      this.loadedFor = id;
      this.refresh();
    });
    effect((onCleanup) => {
      if (!this.autoRefresh()) return;
      const timer = setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) this.refresh();
      }, AUTO_REFRESH_MS);
      onCleanup(() => clearInterval(timer));
    });
    this.destroyRef.onDestroy(() => this.autoRefresh.set(false));
  }

  refresh(): void {
    const id = this.app()?.id;
    if (!id) return;
    this.loading.set(true);
    this.sessionsService.list(id, this.showIdle()).subscribe({
      next: (i) => {
        this.info.set(i);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(consoleError(e));
        this.loading.set(false);
      },
    });
  }

  toggleIdle(): void {
    this.showIdle.set(!this.showIdle());
    this.refresh();
  }

  toggle(pid: number): void {
    this.expanded.set(this.expanded() === pid ? null : pid);
  }

  ask(session: DbSession, action: DbSessionAction): void {
    this.open({ kind: 'session', session, action });
  }

  askClient(client: DbPooledClient): void {
    this.open({ kind: 'client', client });
  }

  private open(p: PendingAction): void {
    this.notice.set(null);
    this.pending.set(p);
    this.dialog().open();
  }

  confirm(): void {
    const p = this.pending();
    const id = this.app()?.id;
    if (!p || !id) return;
    this.dialog().setProcessing(true);
    const done = {
      next: (r: { message: string }) => {
        this.notice.set(r.message);
        this.finish();
      },
      error: (e: unknown) => {
        this.error.set(consoleError(e));
        this.finish();
      },
    };
    if (p.kind === 'client') {
      this.busyClient.set(`${p.client.pod}:${p.client.id}`);
      this.sessionsService.closeClient(id, p.client).subscribe(done);
    } else {
      this.busy.set(p.session.pid);
      this.sessionsService.act(id, p.session, p.action).subscribe(done);
    }
  }

  private finish(): void {
    this.dialog().close();
    this.pending.set(null);
    this.busy.set(null);
    this.busyClient.set(null);
    this.refresh();
  }

  who = whoOf;
  state = stateLabel;
  age = formatAge;
  waiting = waitingOn;
  clientWho = pooledClientWho;

  toneClass(s: DbSession): string {
    switch (stateTone(s)) {
      case 'running':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'waiting':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'held':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }
}
