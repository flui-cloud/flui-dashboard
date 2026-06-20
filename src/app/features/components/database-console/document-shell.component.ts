import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideEraser,
  lucideLoader,
  lucideTerminal,
} from '@ng-icons/lucide';
import { DocumentConsoleService } from '../../service/document-console.service';
import { DocShellResult } from '../../model/document-console.models';
import { JsonViewerComponent } from './json-viewer.component';
import { MongoShellInputComponent } from './mongo-shell-input.component';
import { GateNoticeComponent } from './gate-notice.component';

interface ShellEntry {
  input: string;
  db: string;
  status: 'ok' | 'error' | 'note';
  error?: string;
  note?: string;
  header?: string;
  durationMs?: number;
  mutation?: boolean;
  /** A single number/'null' shown as plain text (count, empty findOne). */
  scalar?: string;
  /** A list of documents/values, each rendered with the json-viewer. */
  docs?: unknown[];
  /** A single object/array rendered with the json-viewer. */
  value?: unknown;
  hasValue?: boolean;
}

const HELP_TEXT = [
  'mongosh-compatible shell. Examples:',
  '  db.users.find({ role: "admin" }).limit(10)',
  '  db.orders.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])',
  '  db.users.updateOne({ _id: ObjectId("…") }, { $set: { … } })   (turn off Read-only)',
  'Helpers: show dbs · show collections · use <db> · clear · help',
  'Enter runs · Shift+Enter newline · ↑/↓ recalls history',
].join('\n');

/**
 * Collapsible mongosh shell, docked at the bottom of the Document Browser. You type a
 * mongosh statement; it is translated to a Mongo command SERVER-SIDE (no JS eval) and run
 * through the read-only-gated path, then the reply is rendered with the same BSON-token
 * viewer as the browse pane. Writes need Read-only off (it is on by default). `use <db>`,
 * `show …`, `clear`, and `help` are handled in-shell, like mongosh.
 */
@Component({
  selector: 'app-document-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    JsonViewerComponent,
    MongoShellInputComponent,
    GateNoticeComponent,
  ],
  providers: [
    provideIcons({ lucideChevronDown, lucideEraser, lucideLoader, lucideTerminal }),
  ],
  template: `
    @if (!expanded()) {
      <button
        type="button"
        (click)="toggle()"
        class="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Open mongo shell"
      >
        <ng-icon name="lucideTerminal" class="h-4 w-4 text-primary" />
        <span class="font-medium">Mongo shell</span>
        <span class="font-mono text-[11px] opacity-70">mongosh</span>
        <ng-icon name="lucideChevronDown" class="ml-auto h-4 w-4 -rotate-90" />
      </button>
    } @else {
      <div class="flex h-72 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div class="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs">
          <ng-icon name="lucideTerminal" class="h-4 w-4 text-primary" />
          <span class="font-medium">Mongo shell</span>
          <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{{ db() }}</span>
          <div class="ml-auto flex items-center gap-2">
            <label
              class="flex items-center gap-1 text-[11px] text-muted-foreground"
              [title]="readOnly() ? 'Reads only — writes are rejected' : 'Writes allowed'"
            >
              <input type="checkbox" [checked]="readOnly()" (change)="toggleReadOnly()" /> Read-only
            </label>
            <button
              type="button"
              (click)="clear()"
              class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Clear"
            >
              <ng-icon name="lucideEraser" class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              (click)="toggle()"
              class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Collapse"
            >
              <ng-icon name="lucideChevronDown" class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="shrink-0 px-3 pt-2">
          <app-gate-notice engine="FerretDB / MongoDB" />
        </div>

        <div #scroll class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 font-mono text-xs">
          @if (entries().length === 0) {
            <p class="whitespace-pre-wrap text-muted-foreground">{{ help }}</p>
          }
          @for (e of entries(); track $index) {
            <div>
              <div class="flex gap-2">
                <span class="shrink-0 select-none text-primary">{{ e.db }}&gt;</span>
                <span class="whitespace-pre-wrap break-all">{{ e.input }}</span>
              </div>
              @if (e.status === 'error') {
                <div class="mt-0.5 flex gap-2 text-red-600 dark:text-red-400">
                  <span class="shrink-0 select-none opacity-0">&gt;</span>
                  <span class="whitespace-pre-wrap break-all">{{ e.error }}</span>
                </div>
              } @else if (e.status === 'note') {
                <div class="mt-0.5 whitespace-pre-wrap pl-4 text-muted-foreground">{{ e.note }}</div>
              } @else {
                <div class="mt-1 pl-4">
                  @if (e.header) {
                    <div class="mb-1 text-[11px] text-muted-foreground">
                      {{ e.header }}@if (e.durationMs !== undefined) { · {{ e.durationMs }}ms }
                    </div>
                  }
                  @if (e.scalar !== undefined) {
                    <span class="text-sky-600 dark:text-sky-400">{{ e.scalar }}</span>
                  } @else if (e.docs) {
                    @for (doc of e.docs; track $index) {
                      <div class="mb-1 rounded border border-border/60 bg-muted/20 p-1.5">
                        <app-json-viewer [value]="doc" [autoExpandDepth]="1" />
                      </div>
                    } @empty {
                      <span class="text-muted-foreground">(none)</span>
                    }
                  } @else if (e.hasValue) {
                    <div class="rounded border border-border/60 bg-muted/20 p-1.5">
                      <app-json-viewer [value]="e.value" [autoExpandDepth]="2" />
                    </div>
                  }
                </div>
              }
            </div>
          }
          @if (running()) {
            <div class="flex items-center gap-2 text-muted-foreground">
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" /> running…
            </div>
          }
        </div>

        <div class="shrink-0 border-t border-border p-2">
          <app-mongo-shell-input
            [prompt]="db() + '>'"
            [disabled]="running()"
            (run)="onRun($event)"
          />
        </div>
      </div>
    }
  `,
})
export class DocumentShellComponent {
  private readonly docs = inject(DocumentConsoleService);

  readonly appId = input.required<string>();
  /** Active database from the page (collection selection). The shell follows it; `use` overrides. */
  readonly database = input<string | null>(null);

  /** Emitted after a write so the page can refresh the browse pane. */
  @Output() readonly changed = new EventEmitter<void>();

  @ViewChild('scroll') private readonly scrollEl?: ElementRef<HTMLDivElement>;
  @ViewChild(MongoShellInputComponent) private readonly inputEl?: MongoShellInputComponent;

  protected readonly help = HELP_TEXT;
  readonly expanded = signal(this.readStore('flui.docshell.expanded') ?? false);
  readonly readOnly = signal(true);
  readonly running = signal(false);
  readonly entries = signal<ShellEntry[]>([]);
  readonly db = signal<string>('test');

  constructor() {
    effect(() => {
      const fromPage = this.database();
      if (fromPage) this.db.set(fromPage);
    });
    effect(() => {
      this.entries();
      this.running();
      const el = this.scrollEl?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
  }

  toggle(): void {
    const v = !this.expanded();
    this.expanded.set(v);
    this.writeStore('flui.docshell.expanded', v);
  }

  toggleReadOnly(): void {
    this.readOnly.update((v) => !v);
  }

  clear(): void {
    this.entries.set([]);
  }

  /**
   * Run a statement from outside (assistant "Run"). Typed commands and reads follow the
   * Read-only toggle. A write the user already confirmed in the chat passes forceWrite: it
   * runs once with writes allowed WITHOUT flipping the persistent toggle, so the shell never
   * stays armed afterwards.
   */
  runStatement(text: string, forceWrite = false): void {
    if (!this.expanded()) this.toggle();
    this.onRun(text, forceWrite);
  }

  /** Place text in the input without running (assistant "Insert"). */
  insert(text: string): void {
    if (!this.expanded()) this.toggle();
    setTimeout(() => this.inputEl?.setText(text));
  }

  // Typed runs follow the Read-only toggle (backend gate authoritative: a write under read-only
  // is rejected, never silently allowed). forceWrite is set only for an assistant write the user
  // already confirmed in chat, and runs that one statement as a write without arming the toggle.
  onRun(text: string, forceWrite = false): void {
    const t = text.trim();
    if (!t || this.running()) return;
    const lower = t.toLowerCase();
    if (lower === 'clear' || lower === 'cls') {
      this.clear();
      return;
    }
    if (lower === 'help') {
      this.push({ input: t, db: this.db(), status: 'note', note: HELP_TEXT });
      return;
    }
    const useMatch = /^use\s+(\S+?)\s*;?$/i.exec(t);
    if (useMatch) {
      this.db.set(useMatch[1]);
      this.push({ input: t, db: this.db(), status: 'note', note: `switched to ${useMatch[1]}` });
      return;
    }

    this.running.set(true);
    this.docs
      .runShell(this.appId(), {
        database: this.db(),
        input: t,
        readOnly: forceWrite ? false : this.readOnly(),
      })
      .subscribe({
        next: (res) => {
          this.push(this.toEntry(t, res));
          this.running.set(false);
          if (res.mutation) this.changed.emit();
        },
        error: (err) => {
          this.push({
            input: t,
            db: this.db(),
            status: 'error',
            error: this.messageFrom(err),
          });
          this.running.set(false);
        },
      });
  }

  private push(entry: ShellEntry): void {
    this.entries.update((list) => [...list, entry].slice(-200));
  }

  // Shape the raw command reply into a mongosh-like transcript entry.
  private toEntry(input: string, res: DocShellResult): ShellEntry {
    const base: ShellEntry = {
      input,
      db: res.database,
      status: 'ok',
      durationMs: res.durationMs,
      mutation: res.mutation,
    };
    const reply = res.reply as Record<string, unknown> | null;
    switch (res.shape) {
      case 'cursor': {
        const docs = this.firstBatch(reply);
        return { ...base, header: this.plural(docs.length, 'document'), docs };
      }
      case 'firstDoc': {
        const doc = this.firstBatch(reply)[0];
        return doc === undefined
          ? { ...base, scalar: 'null' }
          : { ...base, value: doc, hasValue: true };
      }
      case 'count':
        return { ...base, scalar: String(this.num(reply?.['n'])) };
      case 'distinct': {
        const values = (reply?.['values'] as unknown[]) ?? [];
        return { ...base, header: this.plural(values.length, 'value'), docs: values };
      }
      case 'databases': {
        const dbs = (reply?.['databases'] as unknown[]) ?? [];
        return { ...base, header: this.plural(dbs.length, 'database'), value: dbs, hasValue: true };
      }
      case 'collectionNames': {
        const names = this.firstBatch(reply).map((c) =>
          c && typeof c === 'object' ? (c as { name?: string }).name : c,
        );
        return {
          ...base,
          header: this.plural(names.length, 'collection'),
          value: names,
          hasValue: true,
        };
      }
      case 'insert':
        return {
          ...base,
          value: { acknowledged: true, insertedCount: this.num(reply?.['n']) },
          hasValue: true,
        };
      case 'update':
        return {
          ...base,
          value: {
            acknowledged: true,
            matchedCount: this.num(reply?.['n']),
            modifiedCount: this.num(reply?.['nModified']),
            upsertedId: (reply?.['upserted'] as { _id?: unknown }[] | undefined)?.[0]?._id,
          },
          hasValue: true,
        };
      case 'delete':
        return {
          ...base,
          value: { acknowledged: true, deletedCount: this.num(reply?.['n']) },
          hasValue: true,
        };
      default:
        return { ...base, value: reply, hasValue: true };
    }
  }

  private firstBatch(reply: Record<string, unknown> | null): unknown[] {
    const cursor = reply?.['cursor'] as { firstBatch?: unknown[] } | undefined;
    return cursor?.firstBatch ?? [];
  }

  // Reply numbers are canonical EJSON ({ $numberInt: "5" }, …) or plain.
  private num(v: unknown): number {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') {
      const o = v as Record<string, string>;
      const raw =
        o['$numberInt'] ?? o['$numberLong'] ?? o['$numberDouble'] ?? o['$numberDecimal'];
      if (raw !== undefined) return Number(raw);
    }
    return 0;
  }

  private plural(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }

  private messageFrom(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? 'Request failed';
  }

  private readStore(key: string): boolean | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as boolean) : null;
    } catch {
      return null;
    }
  }

  private writeStore(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
}
