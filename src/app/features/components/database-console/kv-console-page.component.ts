import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideClock,
  lucideKeyRound,
  lucidePlay,
  lucideRefreshCw,
  lucideSearch,
} from '@ng-icons/lucide';
import { KvConsoleService } from '../../service/kv-console.service';
import {
  KeyMeta,
  KeyValueRead,
  KeyspaceSummary,
} from '../../model/kv-console.models';
import { JsonViewerComponent } from './json-viewer.component';
import {
  AssistFn,
  DbAssistantChatComponent,
} from './db-assistant-chat.component';
import { GateNoticeComponent } from './gate-notice.component';

type ConnState = 'connecting' | 'connected' | 'error';
const SCAN_COUNT = 100;

@Component({
  selector: 'app-kv-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    JsonViewerComponent,
    DbAssistantChatComponent,
    GateNoticeComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideClock,
      lucideKeyRound,
      lucidePlay,
      lucideRefreshCw,
      lucideSearch,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="back()"
          class="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideKeyRound" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">Key Browser</h1>
          <p class="truncate font-mono text-xs text-muted-foreground">{{ applicationId() }}</p>
        </div>
        <span class="ml-auto text-xs">
          @switch (conn()) {
            @case ('connected') { <span class="text-emerald-600 dark:text-emerald-400">Connected</span> }
            @case ('connecting') { <span class="text-muted-foreground">Connecting…</span> }
            @case ('error') {
              <span class="text-destructive">{{ connError() }}</span>
              <button type="button" (click)="connect()"
                class="ml-2 rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Retry
              </button>
            }
          }
        </span>
      </div>

      <div class="flex h-[calc(100vh-180px)] gap-4">
        <aside class="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-3">
          @if (summary(); as s) {
            <div class="mb-3 rounded-lg border border-border bg-muted/30 p-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-foreground">{{ s.keyCount }} keys</span>
                <button type="button" (click)="connect()" class="text-muted-foreground hover:text-foreground" title="Refresh">
                  <ng-icon name="lucideRefreshCw" class="h-3.5 w-3.5" />
                </button>
              </div>
              <div class="mt-1.5 flex flex-wrap gap-1">
                @for (t of s.byType; track t.type) {
                  <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{{ t.type }} {{ t.count }}</span>
                }
              </div>
            </div>
          }

          <div class="mb-2 flex items-center gap-1.5 rounded-md border border-border px-2">
            <ng-icon name="lucideSearch" class="h-3.5 w-3.5 text-muted-foreground" />
            <input
              [(ngModel)]="match"
              (keydown.enter)="applyFilter()"
              placeholder="MATCH pattern, e.g. user:*"
              class="w-full bg-transparent py-1.5 font-mono text-xs outline-none"
            />
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            @if (scanError(); as e) {
              <div class="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                {{ e }}
              </div>
            }
            @if (keys().length === 0 && (scanning() || conn() === 'connecting')) {
              @for (i of skeletonRows; track i) {
                <div class="mb-1 flex items-center gap-2 px-2 py-1">
                  <span class="h-3.5 w-10 animate-pulse rounded bg-muted"></span>
                  <span class="h-3.5 flex-1 animate-pulse rounded bg-muted/60"></span>
                </div>
              }
            } @else {
              @for (k of keys(); track k.key) {
                <button
                  type="button"
                  (click)="selectKey(k.key)"
                  class="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted/60"
                  [class.bg-muted]="selected()?.key === k.key"
                >
                  <span class="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">{{ k.type }}</span>
                  <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ k.key }}</span>
                </button>
              } @empty {
                <p class="px-2 py-4 text-center text-xs text-muted-foreground">No keys.</p>
              }
            }
          </div>
          @if (cursor() !== '0') {
            <button type="button" (click)="loadMore()" [disabled]="scanning()"
              class="mt-2 w-full rounded-md border border-border py-1.5 text-xs hover:bg-muted disabled:opacity-50">
              {{ scanning() ? 'Loading…' : 'Load more' }}
            </button>
          }
        </aside>

        <section class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div class="flex shrink-0 items-center gap-2 border-b border-border p-2">
            <input
              [(ngModel)]="cmd"
              (keydown.enter)="runManual()"
              placeholder="Command — e.g. SET key value · HSET h f v · DEL key"
              class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
            />
            <label class="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Off = writes allowed">
              <input type="checkbox" [(ngModel)]="cmdReadOnly" /> Read-only
            </label>
            <button
              type="button"
              (click)="runManual()"
              [disabled]="!cmd.trim() || cmdRunning()"
              class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <ng-icon
                [name]="cmdRunning() ? 'lucideRefreshCw' : 'lucidePlay'"
                class="h-3 w-3"
                [class.animate-spin]="cmdRunning()"
              />
              Run
            </button>
          </div>

          <div class="shrink-0 px-2 pt-2">
            <app-gate-notice engine="Redis/Valkey" />
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-4">
          @if (loadingValue()) {
            <p class="text-sm text-muted-foreground">Loading…</p>
          } @else if (selected()) {
            @if (selected(); as v) {
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="rounded bg-muted px-1.5 py-0.5 text-[11px] uppercase text-muted-foreground">{{ v.type }}</span>
              <span class="break-all font-mono text-sm font-medium">{{ v.key }}</span>
              <span class="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <ng-icon name="lucideClock" class="h-3 w-3" /> {{ ttlLabel(v.ttl) }}
              </span>
            </div>
            @if (v.truncated) {
              <p class="mb-2 text-xs text-amber-600 dark:text-amber-400">
                Showing the first elements{{ v.length ? ' of ' + v.length : '' }} — value truncated.
              </p>
            }
            @switch (v.value.kind) {
              @case ('string') {
                @if (asJson(v.value.value); as parsed) {
                  <app-json-viewer [value]="parsed" />
                } @else {
                  <pre class="overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{{ v.value.value }}</pre>
                }
              }
              @case ('hash') {
                <table class="w-full border-collapse text-xs">
                  <tbody>
                    @for (f of v.value.fields; track f.field) {
                      <tr class="border-b border-border/60">
                        <td class="py-1 pr-3 align-top font-mono text-muted-foreground">{{ f.field }}</td>
                        <td class="py-1 font-mono break-all">{{ f.value }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              @case ('list') {
                <ol class="space-y-0.5 font-mono text-xs">
                  @for (it of v.value.items; track $index) {
                    <li class="flex gap-2"><span class="text-muted-foreground">{{ $index }}</span><span class="break-all">{{ it }}</span></li>
                  }
                </ol>
              }
              @case ('set') {
                <ul class="space-y-0.5 font-mono text-xs">
                  @for (m of v.value.members; track $index) { <li class="break-all">{{ m }}</li> }
                </ul>
              }
              @case ('zset') {
                <table class="w-full border-collapse text-xs">
                  <tbody>
                    @for (e of v.value.entries; track $index) {
                      <tr class="border-b border-border/60">
                        <td class="py-1 pr-3 font-mono break-all">{{ e.member }}</td>
                        <td class="py-1 text-right font-mono text-muted-foreground">{{ e.score }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              @default {
                <p class="text-sm text-muted-foreground">{{ v.value.note }}</p>
              }
            }
            }
          } @else {
            <p class="text-sm text-muted-foreground">Select a key to see its value.</p>
          }

          @if (commandError()) {
            <p class="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{{ commandError() }}</p>
          }
          @if (commandReply() !== undefined) {
            <div class="mt-3 rounded-md border border-border bg-muted/30 p-2">
              <p class="mb-1 text-[11px] font-medium text-muted-foreground">Command output</p>
              <app-json-viewer [value]="commandReply()" />
            </div>
          }
          </div>
        </section>

        <app-db-assistant-chat
          [appId]="applicationId() ?? ''"
          storagePrefix="flui.kvconsole"
          identity="Flui database assistant"
          [assist]="kvAssist"
          dataBlindBadge="counts only"
          dataBlindTooltip="The assistant sees only key counts by type — never key names or values."
          emptyHint="Describe what you need — e.g. “keys matching session:*” or “TTL of cart:42”. The assistant proposes a command; you review and run it."
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

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

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
  /** A key-scan failure (separate from the connection state). */
  readonly scanError = signal<string | null>(null);

  cmd = '';
  cmdReadOnly = true;

  readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  readonly kvAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.applicationId() ?? '';
    return this.kv
      .assist(id, { prompt, conversation, ...model })
      .pipe(
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
          // A scan failure is not a connection failure — surface it in the key
          // list, don't poison the "Connected" pill (which never renders it).
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

  ttlLabel(ttl: number): string {
    if (ttl === -1) return 'no expiry';
    if (ttl === -2) return 'missing';
    return `${ttl}s`;
  }

  asJson(value: string): unknown {
    const t = value.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  runManual(): void {
    const command = this.cmd.trim();
    if (!command) return;
    this.execCommand(command, this.cmdReadOnly);
  }

  onChatRun(e: { code: string; mutation: boolean }): void {
    // One-off: writes allowed for this call only (mutation ⇒ readOnly false) without touching
    // the persistent toggle. Mirror the command into the editor for review.
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
