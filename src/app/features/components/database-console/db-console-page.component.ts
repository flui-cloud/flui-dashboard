import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase, lucidePlay } from '@ng-icons/lucide';
import { DbConsoleService } from '../../service/db-console.service';
import { ApplicationService } from '../../service/application.service';
import { accessOf } from '../../model/app-access';
import { AssistFn, DbAssistantChatComponent } from './db-assistant-chat.component';
import { SchemaTree, SqlQueryResult } from '../../model/db-console.models';
import { DbEngine, engineDescriptor } from '../../model/db-engine';
import { DbSchemaTreeComponent } from './db-schema-tree.component';
import { SqlEditorComponent } from './sql-editor.component';
import { SqlResultGridComponent } from './sql-result-grid.component';
import { StoreConsoleHeader } from './store-console-header';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const DEFAULT_LIMIT = 1000;

type ConnState = 'connecting' | 'connected' | 'error';

@Component({
  selector: 'app-db-console-page',
  imports: [
    SlicePipe,
    FormsModule,
    DbSchemaTreeComponent,
    SqlEditorComponent,
    SqlResultGridComponent,
    DbAssistantChatComponent,
    StoreConsoleHeader,
    FlAlert,
    FlPanel,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideDatabase, lucidePlay })],
  template: `
    <div class="fl-page">
      <app-store-console-header
        title="SQL console"
        [appId]="applicationId()"
        [conn]="conn()"
        (retry)="connect()"
      />

      @if (conn() === 'error' && connError(); as e) {
        <fl-alert tone="error" title="Could not reach the database">
          <span class="whitespace-pre-wrap">{{ e }}</span>
        </fl-alert>
      }

      <div class="flex flex-col gap-5 xl:flex-row xl:items-start">
        @if (!showSchema()) {
          <button
            flButton
            [iconOnly]="true"
            type="button"
            (click)="toggleSchema()"
            aria-label="Show schema"
            title="Show schema"
          >
            <fl-icon name="lucideDatabase" />
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

        <section class="fl-stack min-w-0 flex-1" aria-label="Query and results">
          <fl-panel title="Query">
            <div panelActions class="fl-row">
              @if (reader()) {
                <span class="fl-toolbar__info" data-testid="db-console-reader"
                  >Read-only, the showcase's own data</span
                >
              } @else {
                <label class="fl-check">
                  <input
                    type="checkbox"
                    [ngModel]="readOnly()"
                    (ngModelChange)="readOnly.set($event)"
                  />
                  Read-only
                </label>
              }
              <label class="fl-check">
                Limit
                <span class="fl-input w-24">
                  <input
                    type="number"
                    class="fl-num"
                    [ngModel]="limit()"
                    (ngModelChange)="limit.set($event)"
                    min="1"
                    max="10000"
                    aria-label="Row limit"
                  />
                </span>
              </label>
              @if (history().length > 0) {
                <span class="fl-select-wrap">
                  <select
                    class="fl-select fl-select--sm"
                    aria-label="History"
                    (change)="onHistoryPick($event)"
                  >
                    <option value="">History</option>
                    @for (h of history(); track $index) {
                      <option [value]="$index">{{ h | slice: 0 : 60 }}</option>
                    }
                  </select>
                </span>
              }
              <button
                flButton="primary"
                size="sm"
                type="button"
                (click)="run()"
                [disabled]="running()"
                [title]="'Runs the selected text, or the whole editor (' + runShortcut + ')'"
                [attr.aria-keyshortcuts]="isMac ? 'Meta+Enter' : 'Control+Enter'"
              >
                <fl-icon name="lucidePlay" [size]="14" />
                {{ running() ? 'Running' : 'Run' }}
              </button>
            </div>
            <app-sql-editor [engine]="engine()" (run)="run()" />
            <p class="mb-0 mt-2 text-fl-caption text-fl-ink-muted">
              {{ runShortcut }} runs the selected text, or the whole editor when nothing is
              selected.
            </p>
          </fl-panel>

          @if (queryError(); as e) {
            <fl-alert tone="error" title="Query failed">
              <span class="whitespace-pre-wrap">{{ e }}</span>
            </fl-alert>
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
          dataBlindTooltip="The assistant receives your schema and your question, never result data."
          emptyHint="Describe what you need in plain language, for example “list every table and its row count”. The assistant proposes SQL; you review and run it."
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
  private readonly applications = inject(ApplicationService);

  protected readonly isMac =
    typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.userAgent || '');
  protected readonly runShortcut = this.isMac ? '⌘↵' : 'Ctrl+↵';

  readonly editor = viewChild(SqlEditorComponent);

  readonly applicationId = toSignal(this.route.paramMap.pipe(map((p) => p.get('applicationId'))), {
    initialValue: this.route.snapshot.paramMap.get('applicationId'),
  });

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

  readonly reader = computed(() => {
    const id = this.applicationId();
    return !!accessOf(this.applications.applications().find((app) => app.id === id))?.readOnly;
  });

  readonly readOnly = signal(true);
  readonly limit = signal(DEFAULT_LIMIT);

  constructor() {
    this.showSchema.set(this.readStore<boolean>('flui.dbconsole.showSchema') ?? true);
  }

  ngOnInit(): void {
    if (this.applications.applications().length === 0) void this.applications.loadApplications();
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
    const sqlText = (this.editor()?.currentQuery() ?? '').trim();
    if (!id || !sqlText || this.running()) return;
    this.running.set(true);
    this.queryError.set(null);
    this.dbConsole
      .runQuery(id, {
        sql: sqlText,
        readOnly: this.reader() || (forceWrite ? false : this.readOnly()),
        limit: this.limit(),
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
    this.editor()?.setText(`SELECT * FROM ${qualified} LIMIT 100;`);
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
    this.editor()?.setText(sql);
  }

  onChatRun(e: { code: string; mutation: boolean }): void {
    this.editor()?.setText(e.code);
    this.run(e.mutation);
  }

  onHistoryPick(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx !== '') {
      const item = this.history()[Number(idx)];
      if (item) this.editor()?.setText(item);
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
