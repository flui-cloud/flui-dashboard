import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucidePlay, lucideRefreshCw, lucideSearch } from '@ng-icons/lucide';
import { KvConsoleService } from '../../service/kv-console.service';
import { KeyMeta, KeyValueRead, KeyspaceSummary } from '../../model/kv-console.models';
import { JsonViewerComponent } from './json-viewer.component';
import { AssistFn, DbAssistantChatComponent } from './db-assistant-chat.component';
import { GateNoticeComponent } from './gate-notice.component';
import { KvValueView } from './kv-value-view';
import { StoreConsoleHeader } from './store-console-header';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

type ConnState = 'connecting' | 'connected' | 'error';
const SCAN_COUNT = 100;

@Component({
  selector: 'app-kv-console-page',
  imports: [
    FormsModule,
    JsonViewerComponent,
    DbAssistantChatComponent,
    GateNoticeComponent,
    KvValueView,
    StoreConsoleHeader,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
  ],
  viewProviders: [provideIcons({ lucideKeyRound, lucidePlay, lucideRefreshCw, lucideSearch })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="Key browser"
        [appId]="applicationId()"
        [conn]="conn()"
        (retry)="connect()"
      />

      @if (conn() === 'error' && connError(); as e) {
        <fl-alert tone="error" title="Could not reach the store">
          <span class="whitespace-pre-wrap">{{ e }}</span>
        </fl-alert>
      }

      <div class="flex flex-col gap-5 xl:flex-row xl:items-start">
        <aside
          class="fl-panel flex max-h-screen w-full shrink-0 xl:sticky xl:top-0 xl:w-80 flex-col self-stretch"
          aria-label="Keys"
        >
          <header class="fl-panel__header">
            <h2 class="fl-panel__title">
              Keys
              @if (summary(); as s) {
                <span class="fl-panel__count">({{ s.keyCount }})</span>
              }
            </h2>
            <div class="fl-panel__actions">
              <button
                flButton="ghost"
                size="sm"
                [iconOnly]="true"
                type="button"
                (click)="connect()"
                aria-label="Refresh keys"
                title="Refresh keys"
              >
                <fl-icon name="lucideRefreshCw" [size]="14" />
              </button>
            </div>
          </header>
          <div class="flex flex-col gap-2 border-b border-fl-border px-3 py-3">
            <label class="fl-input">
              <fl-icon name="lucideSearch" [size]="14" />
              <input
                class="font-mono"
                [(ngModel)]="match"
                (keydown.enter)="applyFilter()"
                aria-label="Match pattern"
                placeholder="MATCH pattern, e.g. user:*"
              />
            </label>
            @if (summary(); as s) {
              @if (s.byType.length) {
                <p class="fl-toolbar__info m-0 font-mono">
                  @for (t of s.byType; track t.type; let last = $last) {
                    {{ t.type }} {{ t.count }}{{ last ? '' : ' · ' }}
                  }
                </p>
              }
            }
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            @if (scanError(); as e) {
              <div class="p-3">
                <fl-alert tone="error" title="Could not list keys">{{ e }}</fl-alert>
              </div>
            }
            @if (keys().length === 0 && (scanning() || conn() === 'connecting')) {
              <fl-loading-state [rows]="8" />
            } @else {
              <ul class="m-0 list-none py-1 pl-0">
                @for (k of keys(); track k.key) {
                  <li>
                    <button
                      type="button"
                      (click)="selectKey(k.key)"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-fl-surface-hover"
                      [class.bg-fl-accent-soft]="selected()?.key === k.key"
                      [attr.aria-current]="selected()?.key === k.key ? 'true' : null"
                    >
                      <span class="w-12 shrink-0 font-mono text-fl-caption text-fl-ink-muted">{{
                        k.type
                      }}</span>
                      <span
                        class="min-w-0 flex-1 truncate font-mono text-fl-mono-sm"
                        [class.text-fl-accent]="selected()?.key === k.key"
                        >{{ k.key }}</span
                      >
                    </button>
                  </li>
                }
              </ul>
              @if (keys().length === 0) {
                <fl-empty-state
                  [compact]="true"
                  icon="lucideKeyRound"
                  [title]="match.trim() ? 'No keys match the pattern' : 'No keys'"
                />
              }
            }
          </div>
          @if (cursor() !== '0') {
            <div class="border-t border-fl-border p-3">
              <button
                flButton
                size="sm"
                [block]="true"
                type="button"
                (click)="loadMore()"
                [disabled]="scanning()"
              >
                {{ scanning() ? 'Loading' : 'Load more' }}
              </button>
            </div>
          }
        </aside>

        <section class="fl-stack min-w-0 flex-1" aria-label="Command and value">
          <fl-panel title="Command">
            <div class="flex flex-wrap items-center gap-3">
              <label class="fl-input min-w-0 flex-1">
                <input
                  class="font-mono"
                  [(ngModel)]="cmd"
                  (keydown.enter)="runManual()"
                  aria-label="Command"
                  placeholder="SET key value · HSET h f v · DEL key"
                />
              </label>
              <label class="fl-check" title="Clear to allow writes">
                <input type="checkbox" [(ngModel)]="cmdReadOnly" /> Read-only
              </label>
              <button
                flButton="primary"
                size="sm"
                type="button"
                (click)="runManual()"
                [disabled]="!cmd.trim() || cmdRunning()"
              >
                <fl-icon name="lucidePlay" [size]="14" />
                {{ cmdRunning() ? 'Running' : 'Run' }}
              </button>
            </div>
            <div class="mt-3 flex flex-col gap-3">
              <app-gate-notice engine="Redis/Valkey" />
              @if (commandError()) {
                <fl-alert tone="error" title="Command failed">
                  <span class="whitespace-pre-wrap">{{ commandError() }}</span>
                </fl-alert>
              }
              @if (commandReply() !== undefined) {
                <div class="rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3">
                  <p class="m-0 mb-1 text-fl-caption font-semibold text-fl-ink-secondary">Output</p>
                  <app-json-viewer [value]="commandReply()" />
                </div>
              }
            </div>
          </fl-panel>

          <app-kv-value-view [value]="selected()" [loading]="loadingValue()" />
        </section>

        <app-db-assistant-chat
          [appId]="applicationId() ?? ''"
          storagePrefix="flui.kvconsole"
          identity="Flui database assistant"
          [assist]="kvAssist"
          dataBlindBadge="counts only"
          dataBlindTooltip="The assistant sees only key counts by type, never key names or values."
          emptyHint="Describe what you need, for example “keys matching session:*” or “TTL of cart:42”. The assistant proposes a command; you review and run it."
          codeNoun="command"
          (run)="onChatRun($event)"
        />
      </div>
    </div>
  `,
})
export class KvConsolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly kv = inject(KvConsoleService);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

  readonly conn = signal<ConnState>('connecting');
  readonly connError = signal<string | null>(null);
  readonly summary = signal<KeyspaceSummary | null>(null);
  readonly keys = signal<KeyMeta[]>([]);
  readonly cursor = signal<string>('0');
  readonly scanning = signal(false);
  match = '';

  readonly selected = signal<KeyValueRead | null>(null);
  readonly loadingValue = signal(false);
  readonly commandReply = signal<unknown>(undefined);
  readonly commandError = signal<string | null>(null);
  readonly cmdRunning = signal(false);
  readonly scanError = signal<string | null>(null);

  cmd = '';
  cmdReadOnly = true;

  readonly kvAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.applicationId() ?? '';
    return this.kv.assist(id, { prompt, conversation, ...model }).pipe(
      map((r) => ({
        text: r.explanation,
        code: r.command || undefined,
        mutation: r.mutation,
      })),
    );
  };

  ngOnInit(): void {
    this.connect();
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.applicationId()]);
  }

  connect(): void {
    const id = this.applicationId();
    if (!id) return;
    this.conn.set('connecting');
    this.connError.set(null);
    this.keys.set([]);
    this.cursor.set('0');
    this.kv.getSummary(id).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.conn.set('connected');
        this.loadMore();
      },
      error: (err) => {
        this.conn.set('error');
        this.connError.set(this.messageFrom(err));
      },
    });
  }

  applyFilter(): void {
    this.keys.set([]);
    this.cursor.set('0');
    this.loadMore();
  }

  loadMore(): void {
    const id = this.applicationId();
    if (!id || this.scanning()) return;
    this.scanning.set(true);
    this.kv
      .scanKeys(id, {
        cursor: this.cursor(),
        match: this.match.trim() || undefined,
        count: SCAN_COUNT,
      })
      .subscribe({
        next: (res) => {
          this.keys.update((k) => [...k, ...res.keys]);
          this.cursor.set(res.cursor);
          this.scanError.set(null);
          this.scanning.set(false);
        },
        error: (err) => {
          this.scanning.set(false);
          this.scanError.set(this.messageFrom(err));
        },
      });
  }

  selectKey(key: string): void {
    const id = this.applicationId();
    if (!id) return;
    this.loadingValue.set(true);
    this.commandReply.set(undefined);
    this.commandError.set(null);
    this.kv.readValue(id, key).subscribe({
      next: (v) => {
        this.selected.set(v);
        this.loadingValue.set(false);
      },
      error: (err) => {
        this.loadingValue.set(false);
        this.commandError.set(this.messageFrom(err));
      },
    });
  }

  runManual(): void {
    const command = this.cmd.trim();
    if (!command) return;
    this.execCommand(command, this.cmdReadOnly);
  }

  onChatRun(e: { code: string; mutation: boolean }): void {
    this.cmd = e.code;
    this.execCommand(e.code, !e.mutation);
  }

  private execCommand(command: string, readOnly: boolean): void {
    const id = this.applicationId();
    if (!id || this.cmdRunning()) return;
    this.commandError.set(null);
    this.commandReply.set(undefined);
    this.cmdRunning.set(true);
    this.kv.runCommand(id, { args: this.tokenize(command), readOnly }).subscribe({
      next: (res) => {
        this.commandReply.set(res.reply);
        this.cmdRunning.set(false);
        if (!readOnly) {
          this.connect();
          const open = this.selected();
          if (open) this.selectKey(open.key);
        }
      },
      error: (err) => {
        this.cmdRunning.set(false);
        this.commandError.set(this.messageFrom(err));
      },
    });
  }

  private tokenize(command: string): string[] {
    const out: string[] = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(command)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
    return out;
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}
