import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
  output,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp, lucideEraser, lucideTerminal } from '@ng-icons/lucide';
import { DocumentConsoleService } from '../../service/document-console.service';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { JsonViewerComponent } from './json-viewer.component';
import { MongoShellInputComponent } from './mongo-shell-input.component';
import { GateNoticeComponent } from './gate-notice.component';
import { ShellEntry, toShellEntry } from './document-shell-entry';

const HELP_TEXT = [
  'mongosh-compatible shell. Examples:',
  '  db.users.find({ role: "admin" }).limit(10)',
  '  db.orders.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])',
  '  db.users.updateOne({ _id: ObjectId("…") }, { $set: { … } })   (clear Read-only)',
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
  host: { class: 'block' },
  imports: [
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
    JsonViewerComponent,
    MongoShellInputComponent,
    GateNoticeComponent,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp, lucideEraser, lucideTerminal })],
  template: `
    @if (!expanded()) {
      <button
        type="button"
        (click)="toggle()"
        class="fl-panel flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-fl-surface-hover"
        aria-label="Open mongo shell"
      >
        <fl-icon class="text-fl-ink-muted" name="lucideTerminal" />
        <span class="text-fl-body-sm font-semibold">Mongo shell</span>
        <span class="font-mono text-fl-mono-sm text-fl-ink-muted">mongosh</span>
        <fl-icon class="ml-auto text-fl-ink-muted" name="lucideChevronUp" />
      </button>
    } @else {
      <div class="fl-panel flex h-96 flex-col" role="region" aria-label="Mongo shell">
        <header class="fl-panel__header">
          <h2 class="fl-panel__title flex items-center gap-2">
            Mongo shell
            <span class="font-mono text-fl-mono-sm font-normal text-fl-ink-muted">{{ db() }}</span>
          </h2>
          <div class="fl-panel__actions">
            <label
              class="fl-check"
              [title]="readOnly() ? 'Reads only, writes are rejected' : 'Writes allowed'"
            >
              <input type="checkbox" [checked]="readOnly()" (change)="toggleReadOnly()" /> Read-only
            </label>
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              (click)="clear()"
              aria-label="Clear"
              title="Clear"
            >
              <fl-icon name="lucideEraser" [size]="14" />
            </button>
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              (click)="toggle()"
              aria-label="Hide mongo shell"
              title="Hide mongo shell"
            >
              <fl-icon name="lucideChevronDown" [size]="14" />
            </button>
          </div>
        </header>

        <div class="shrink-0 px-4 pt-3">
          <app-gate-notice engine="FerretDB / MongoDB" />
        </div>

        <div
          #scroll
          class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 font-mono text-fl-mono-sm"
        >
          @if (entries().length === 0) {
            <p class="m-0 whitespace-pre-wrap text-fl-ink-muted">{{ help }}</p>
          }
          @for (e of entries(); track $index) {
            <div>
              <div class="flex gap-2">
                <span class="shrink-0 select-none text-fl-accent">{{ e.db }}&gt;</span>
                <span class="whitespace-pre-wrap break-all">{{ e.input }}</span>
              </div>
              @if (e.status === 'error') {
                <div class="mt-1 flex items-start gap-2 pl-4">
                  <fl-status tone="error" label="Error" />
                  <span class="whitespace-pre-wrap break-all">{{ e.error }}</span>
                </div>
              } @else if (e.status === 'note') {
                <div class="mt-1 whitespace-pre-wrap pl-4 text-fl-ink-muted">{{ e.note }}</div>
              } @else {
                <div class="mt-1 pl-4">
                  @if (e.header) {
                    <div class="fl-num mb-1 text-fl-caption text-fl-ink-muted">
                      {{ e.header }}
                      @if (e.durationMs !== undefined) {
                        · {{ e.durationMs }} ms
                      }
                    </div>
                  }
                  @if (e.scalar !== undefined) {
                    <span class="text-fl-accent-strong">{{ e.scalar }}</span>
                  } @else if (e.docs) {
                    @for (doc of e.docs; track $index) {
                      <div class="border-b border-fl-border-subtle py-1.5">
                        <app-json-viewer [value]="doc" [autoExpandDepth]="1" />
                      </div>
                    } @empty {
                      <span class="text-fl-ink-muted">(none)</span>
                    }
                  } @else if (e.hasValue) {
                    <app-json-viewer [value]="e.value" [autoExpandDepth]="2" />
                  }
                </div>
              }
            </div>
          }
          @if (running()) {
            <div class="flex items-center gap-2 text-fl-ink-muted">
              <fl-spinner label="Running" /> Running
            </div>
          }
        </div>

        <div class="shrink-0 border-t border-fl-border px-4 py-3">
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
  readonly database = input<string | null>(null);

  readonly changed = output<void>();

  private readonly scrollEl = viewChild<ElementRef<HTMLDivElement>>('scroll');
  private readonly inputEl = viewChild(MongoShellInputComponent);

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
      const el = this.scrollEl()?.nativeElement;
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

  runStatement(text: string, forceWrite = false): void {
    if (!this.expanded()) this.toggle();
    this.onRun(text, forceWrite);
  }

  insert(text: string): void {
    if (!this.expanded()) this.toggle();
    setTimeout(() => this.inputEl()?.setText(text));
  }

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
          this.push(toShellEntry(t, res));
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
      return;
    }
  }
}
