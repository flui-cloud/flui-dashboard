import {
  Component,
  OnInit,
  ViewChild,
  computed,
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
  lucideDatabase,
  lucideLoader,
  lucidePlay,
  lucideRotateCcw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DbConsoleService } from '../../service/db-console.service';
import {
  AssistFn,
  DbAssistantChatComponent,
} from './db-assistant-chat.component';
import { SchemaTree, SqlQueryResult } from '../../model/db-console.models';
import { DbEngine, engineDescriptor } from '../../model/db-engine';
import { DbSchemaTreeComponent } from './db-schema-tree.component';
import { SqlEditorComponent } from './sql-editor.component';
import { SqlResultGridComponent } from './sql-result-grid.component';

const DEFAULT_LIMIT = 1000;

type ConnState = 'connecting' | 'connected' | 'error';

@Component({
  selector: 'app-db-console-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    DbSchemaTreeComponent,
    SqlEditorComponent,
    SqlResultGridComponent,
    DbAssistantChatComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideDatabase,
      lucideLoader,
      lucidePlay,
      lucideRotateCcw,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          (click)="back()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary" />
        <div class="min-w-0">
          <h1 class="text-base font-semibold text-foreground">SQL Console</h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2 text-xs">
          @switch (conn()) {
            @case ('connecting') {
              <span class="inline-flex items-center gap-1 text-muted-foreground">
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Connecting…
              </span>
            }
            @case ('connected') {
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                Connected
              </span>
            }
            @case ('error') {
              <button
                type="button"
                (click)="connect()"
                class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
              >
                <ng-icon name="lucideRotateCcw" class="h-3.5 w-3.5" /> Retry
              </button>
            }
          }
        </div>
      </div>

      @if (conn() === 'error' && connError(); as e) {
        <div
          class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div class="font-medium">Couldn't reach the database.</div>
            <div class="mt-0.5 whitespace-pre-wrap text-xs">{{ e }}</div>
          </div>
        </div>
      }

      <div class="flex h-[calc(100vh-180px)] gap-4">
        @if (!showSchema()) {
          <button
            type="button"
            (click)="toggleSchema()"
            title="Show schema"
            class="flex h-8 w-8 shrink-0 self-start items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ng-icon name="lucideDatabase" class="h-4 w-4" />
          </button>
        } @else {
          <app-db-schema-tree
            [schema]="schema()"
            [loading]="conn() === 'connecting'"
            (refresh)="connect()"
            (collapse)="toggleSchema()"
            (browse)="browseTable($event.schema, $event.table)"
          />
        }

        <section class="flex min-w-0 flex-1 flex-col gap-3">
          <app-sql-editor [engine]="engine()" (run)="run()" />

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              (click)="run()"
              [disabled]="running()"
              title="Runs the selected text, or the whole editor if nothing is selected"
              class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <ng-icon name="lucidePlay" class="h-4 w-4" />
              {{ running() ? 'Running…' : 'Run' }}
              <span class="text-xs opacity-70">{{ runShortcut }}</span>
            </button>

            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="readOnly" /> Read-only
            </label>

            <label class="flex items-center gap-2 text-sm">
              Limit
              <input
                type="number"
                [(ngModel)]="limit"
                min="1"
                max="10000"
                class="w-20 rounded border border-border bg-transparent px-2 py-1"
              />
            </label>

            @if (history().length > 0) {
              <select
                (change)="onHistoryPick($event)"
                class="rounded border border-border bg-transparent px-2 py-1 text-sm"
              >
                <option value="">History…</option>
                @for (h of history(); track $index) {
                  <option [value]="$index">{{ h | slice: 0 : 60 }}</option>
                }
              </select>
            }
          </div>

          @if (queryError(); as e) {
            <div
              class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
              <span class="whitespace-pre-wrap">{{ e }}</span>
            </div>
          }

          <app-sql-result-grid [result]="result()" />
        </section>

        <app-db-assistant-chat
          [appId]="applicationId() ?? ''"
          storagePrefix="flui.dbconsole"
          identity="Flui SQL Assistant"
          [assist]="sqlAssist"
          [showInsert]="true"
          dataBlindBadge="schema only"
          dataBlindTooltip="The assistant receives your schema and your question — never result data."
          emptyHint="Describe what you need in plain language — e.g. “list every table and its row count”. The assistant proposes SQL; you review and run it."
          codeNoun="query"
          (insert)="onChatInsert($event)"
          (run)="onChatRun($event)"
        />
      </div>
    </div>
  `,
})
export class DbConsolePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dbConsole = inject(DbConsoleService);

  protected readonly isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iP(hone|ad|od)/.test(navigator.userAgent || '');
  protected readonly runShortcut = this.isMac ? '⌘↵' : 'Ctrl+↵';

  @ViewChild(SqlEditorComponent)
  editor?: SqlEditorComponent;

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  readonly conn = signal<ConnState>('connecting');
  readonly connError = signal<string | null>(null);
  readonly showSchema = signal(true);
  readonly schema = signal<SchemaTree | null>(null);
  readonly engine = computed<DbEngine>(() => this.schema()?.engine ?? 'postgres');
  readonly running = signal(false);
  readonly result = signal<SqlQueryResult | null>(null);
  readonly queryError = signal<string | null>(null);
  readonly history = signal<string[]>([]);

  readonly sqlAssist: AssistFn = (prompt, conversation, model) => {
    const id = this.applicationId() ?? '';
    return this.dbConsole
      .assist(id, { prompt, conversation, ...model })
      .pipe(map((r) => ({ text: r.explanation, code: r.sql || undefined, mutation: r.mutation })));
  };

  readOnly = true;
  limit = DEFAULT_LIMIT;

  constructor() {
    this.showSchema.set(this.readStore<boolean>('flui.dbconsole.showSchema') ?? true);
  }

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
    this.dbConsole.getSchema(id).subscribe({
      next: (tree) => {
        this.schema.set(tree);
        this.conn.set('connected');
      },
      error: (err) => {
        this.conn.set('error');
        this.connError.set(this.messageFrom(err));
      },
    });
  }

  run(forceWrite = false): void {
    const id = this.applicationId();
    const sqlText = (this.editor?.currentQuery() ?? '').trim();
    if (!id || !sqlText || this.running()) return;
    this.running.set(true);
    this.queryError.set(null);
    this.dbConsole
      .runQuery(id, {
        sql: sqlText,
        readOnly: forceWrite ? false : this.readOnly,
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          this.result.set(res);
          if (this.conn() !== 'connected') this.conn.set('connected');
          this.pushHistory(sqlText);
          this.running.set(false);
          if (/^(CREATE|DROP|ALTER|TRUNCATE|RENAME|COMMENT)/i.test(res.command)) {
            this.connect();
          }
        },
        error: (err) => {
          this.queryError.set(this.messageFrom(err));
          this.running.set(false);
        },
      });
  }

  browseTable(schemaName: string, tableName: string): void {
    const qualified = `${this.quoteIdent(schemaName)}.${this.quoteIdent(tableName)}`;
    this.editor?.setText(`SELECT * FROM ${qualified} LIMIT 100;`);
    this.run();
  }

  private quoteIdent(name: string): string {
    const q = engineDescriptor(this.engine()).quoteIdent;
    return q ? q(name) : `"${name.replaceAll('"', '""')}"`;
  }

  toggleSchema(): void {
    const v = !this.showSchema();
    this.showSchema.set(v);
    this.writeStore('flui.dbconsole.showSchema', v);
  }

  onChatInsert(sql: string): void {
    this.editor?.setText(sql);
  }

  onChatRun(e: { code: string; mutation: boolean }): void {
    this.editor?.setText(e.code);
    // Confirmed-in-chat write runs once as a one-off; the read-only toggle stays as the user left it.
    this.run(e.mutation);
  }

  onHistoryPick(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx !== '') {
      const item = this.history()[Number(idx)];
      if (item) this.editor?.setText(item);
    }
    target.value = '';
  }

  private pushHistory(sqlText: string): void {
    this.history.set([sqlText, ...this.history().filter((h) => h !== sqlText)].slice(0, 50));
  }

  private readStore<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private writeStore(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }
}
