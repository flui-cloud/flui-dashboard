import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
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
import { consoleError } from '../database-console/search-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { SessionsPooler } from './sessions-pooler';
import {
  PendingAction,
  confirmCopy,
  formatAge,
  orderByBlocker,
  poolerSummary,
  stateLabel,
  stateTone,
  summaryLine,
  waitingOn,
  whoOf,
} from './app-sessions-view';

const AUTO_REFRESH_MS = 5000;

const TONE: Record<ReturnType<typeof stateTone>, StatusTone> = {
  running: 'success',
  waiting: 'warning',
  held: 'warning',
  idle: 'neutral',
};

const INDENT = ['', 'pl-8', 'pl-12', 'pl-16'];

@Component({
  selector: 'app-sessions-tab',
  imports: [
    DatePipe,
    ConfirmationDialogComponent,
    SessionsPooler,
    FlPanel,
    FlTable,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
    FlActionsMenu,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  host: { class: 'fl-stack', 'data-testid': 'sessions-tab' },
  template: `
    @if (!supported()) {
      <fl-panel title="Sessions">
        <fl-empty-state
          [compact]="true"
          title="Not available"
          body="Active sessions are shown for managed PostgreSQL databases."
          data-testid="sessions-unsupported"
        />
      </fl-panel>
    } @else if (!dataAccess()) {
      <fl-panel title="Sessions">
        <fl-empty-state
          [compact]="true"
          title="No data access"
          body="Your access to this database does not include its data."
        />
      </fl-panel>
    } @else {
      <fl-panel title="Sessions">
        <div panelActions class="flex flex-wrap items-center gap-3">
          <label class="fl-check">
            <input
              type="checkbox"
              [checked]="showIdle()"
              (change)="toggleIdle()"
              data-testid="sessions-show-idle"
            />
            Show idle
          </label>
          <label class="fl-check">
            <input
              type="checkbox"
              [checked]="autoRefresh()"
              (change)="autoRefresh.set(!autoRefresh())"
              data-testid="sessions-auto-refresh"
            />
            Every 5 s
          </label>
          <button
            flButton
            size="sm"
            type="button"
            (click)="refresh()"
            [disabled]="loading()"
            data-testid="sessions-refresh"
          >
            @if (loading()) {
              <fl-spinner label="Refreshing" />
            } @else {
              <fl-icon name="lucideRefreshCw" />
            }
            Refresh
          </button>
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-3">
            @if (info(); as i) {
              <fl-status
                [tone]="i.counts.blocked ? 'warning' : 'success'"
                [label]="i.counts.blocked ? 'Sessions blocked' : 'Healthy'"
              />
            }
            <p class="text-fl-body-sm text-fl-ink-secondary" data-testid="sessions-summary">
              {{ info() ? summary() : 'Reading sessions…' }}
            </p>
          </div>
          @if (error()) {
            <fl-alert tone="error" title="Could not read sessions" data-testid="sessions-error">{{
              error()
            }}</fl-alert>
          }
          @if (notice()) {
            <fl-status tone="success" [label]="notice()!" data-testid="sessions-notice" />
          }
          @if (info(); as i) {
            <p class="text-fl-caption text-fl-ink-muted">
              Values in queries are hidden. Read at
              <time class="fl-num" [attr.datetime]="i.capturedAt" [title]="i.capturedAt">{{
                i.capturedAt | date: 'mediumTime'
              }}</time>.
            </p>
          }
        </div>
      </fl-panel>

      @if (info(); as i) {
        <fl-panel title="Connections" [count]="rows().length" [flush]="true">
          @if (!rows().length) {
            <fl-empty-state
              [compact]="true"
              title="No active sessions"
              body="No session is doing anything right now."
              data-testid="sessions-empty"
            />
          } @else {
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Who</th>
                    <th scope="col">State</th>
                    <th scope="col" class="is-num">For</th>
                    <th scope="col">Query</th>
                    <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.session.pid) {
                    @let s = row.session;
                    <tr
                      class="cursor-pointer"
                      [class.is-selected]="expanded() === s.pid"
                      [attr.data-testid]="'session-' + s.pid"
                      (click)="toggle(s.pid)"
                    >
                      <td [class]="indent(row.depth)">
                        @if (row.depth) {
                          <span class="mr-1 text-fl-ink-muted" aria-hidden="true">└</span>
                        }
                        {{ who(s) }}
                        @if (s.blocks) {
                          <fl-status
                            class="ml-2"
                            tone="warning"
                            [label]="'Blocking ' + s.blocks"
                            [attr.data-testid]="'session-blocking-' + s.pid"
                          />
                        }
                      </td>
                      <td><fl-status [tone]="toneOf(s)" [label]="stateText(s)" /></td>
                      <td class="is-num text-fl-ink-muted">
                        {{ age(s.xactAgeMs ?? s.stateAgeMs) }}
                      </td>
                      <td class="fl-mono max-w-md truncate" [title]="s.query">
                        {{ s.query || '—' }}
                      </td>
                      <td class="is-fit" (click)="$event.stopPropagation()">
                        <div class="flex items-center justify-end gap-1">
                          <button
                            flButton
                            size="sm"
                            type="button"
                            [disabled]="!s.actions.cancel || busy() === s.pid"
                            [title]="
                              s.actions.cancel
                                ? 'Cancel query'
                                : (s.actions.reason ?? 'Not available')
                            "
                            [attr.data-testid]="'session-cancel-' + s.pid"
                            (click)="ask(s, 'cancel')"
                          >
                            Cancel query
                          </button>
                          <fl-actions-menu
                            label="Session actions"
                            [compact]="true"
                            [items]="actionsFor(s)"
                            [attr.title]="s.actions.terminate ? null : s.actions.reason"
                            [attr.data-testid]="'session-actions-' + s.pid"
                            (action)="ask(s, 'terminate')"
                          />
                        </div>
                      </td>
                    </tr>
                    @if (expanded() === s.pid) {
                      <tr [attr.data-testid]="'session-detail-' + s.pid">
                        <td colspan="5" class="whitespace-normal">
                          <fl-key-value class="fl-kv--compact py-2">
                            <fl-kv-item key="Session" [mono]="true">{{ s.pid }}</fl-kv-item>
                            <fl-kv-item key="User · database" [mono]="true"
                              >{{ s.user }} · {{ s.database }}</fl-kv-item
                            >
                            @if (s.applicationName) {
                              <fl-kv-item key="Application name">{{
                                s.applicationName
                              }}</fl-kv-item>
                            }
                            @if (s.clientAddr) {
                              <fl-kv-item key="Address" [mono]="true">{{
                                s.clientAddr
                              }}</fl-kv-item>
                            }
                            @if (waiting(s); as w) {
                              <fl-kv-item key="Waiting on">{{ w }}</fl-kv-item>
                            }
                            <fl-kv-item key="Transaction open"
                              >{{ age(s.xactAgeMs)
                              }}{{ s.writing ? ' · has written' : '' }}</fl-kv-item
                            >
                            <fl-kv-item key="Statement running">{{ age(s.queryAgeMs) }}</fl-kv-item>
                            @if (s.actions.reason) {
                              <fl-kv-item key="Actions">{{ s.actions.reason }}</fl-kv-item>
                            }
                            <fl-kv-item class="col-span-full" key="Query" [mono]="true">
                              <span class="whitespace-pre-wrap break-all">{{
                                s.query || '—'
                              }}</span>
                            </fl-kv-item>
                          </fl-key-value>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            @if (i.truncated) {
              <p
                class="border-t border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted"
              >
                More sessions exist than are listed.
              </p>
            }
          }
        </fl-panel>

        @if (i.pooler; as p) {
          <app-sessions-pooler
            [pooler]="p"
            [summary]="poolerLine()"
            [busyClient]="busyClient()"
            (closeClient)="askClient($event)"
          />
        }
      }
    }

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

  toneOf(s: DbSession): StatusTone {
    return TONE[stateTone(s)];
  }

  stateText(s: DbSession): string {
    const label = stateLabel(s);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  indent(depth: number): string {
    return INDENT[Math.min(depth, INDENT.length - 1)];
  }

  actionsFor(s: DbSession): MenuAction[] {
    return [
      {
        id: 'terminate',
        label: 'Close session',
        danger: true,
        disabled: !s.actions.terminate || this.busy() === s.pid,
      },
    ];
  }
}
