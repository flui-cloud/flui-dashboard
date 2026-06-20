import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLockKeyhole,
  lucideLockKeyholeOpen,
  lucidePlay,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { GateNoticeComponent } from './gate-notice.component';

/**
 * Engine-neutral "Dev Tools" REST console: type `METHOD /path` on the first line
 * and an optional JSON body below, run it, see the raw response. A read-only gate
 * (on by default) is enforced server-side; the UI just reflects/sets it. Decoupled
 * from any one engine via the `submit` input — the page wires its own service.
 */
export interface RawConsoleRequest {
  method: string;
  path: string;
  body?: unknown;
  readOnly: boolean;
}
export interface RawConsoleResponse {
  status: number;
  durationMs: number;
  body: unknown;
}
export interface RawConsoleExample {
  label: string;
  /** Full editor text, e.g. "PUT /products\n{ \"mappings\": { ... } }". */
  text: string;
  /** Hint that this example mutates — shown so users know it needs read-only off. */
  write?: boolean;
}
export type RawConsoleSubmit = (
  req: RawConsoleRequest,
) => Observable<RawConsoleResponse>;

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

@Component({
  selector: 'app-rest-console',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, NgClass, FormsModule, GateNoticeComponent],
  providers: [
    provideIcons({
      lucideLockKeyhole,
      lucideLockKeyholeOpen,
      lucidePlay,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="flex h-full min-w-0 flex-col gap-2">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-foreground">{{ title() }}</span>
        <span class="font-mono text-xs text-muted-foreground">{{ syntaxHint() }}</span>

        <button
          type="button"
          (click)="readOnly.set(!readOnly())"
          class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs"
          [ngClass]="
            readOnly()
              ? 'border-border text-muted-foreground'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          "
          [title]="
            readOnly()
              ? 'Read-only is on — mutating requests are blocked. Click to allow writes.'
              : 'Writes ALLOWED — create/delete/update will run. Click to lock.'
          "
        >
          <ng-icon
            [name]="readOnly() ? 'lucideLockKeyhole' : 'lucideLockKeyholeOpen'"
            class="h-3.5 w-3.5"
          />
          {{ readOnly() ? 'Read-only' : 'Writes allowed' }}
        </button>

        <button
          type="button"
          (click)="run()"
          [disabled]="running()"
          class="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <ng-icon name="lucidePlay" class="h-3.5 w-3.5" />
          {{ running() ? 'Running…' : 'Run' }}
        </button>
      </div>

      <app-gate-notice [engine]="engineLabel()" />

      <!-- Examples -->
      @if (examples().length) {
        <div class="flex flex-wrap items-center gap-1.5">
          @for (ex of examples(); track ex.label) {
            <button
              type="button"
              (click)="load(ex)"
              class="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              [title]="ex.write ? 'Needs writes allowed' : 'Read-only'"
            >
              {{ ex.label }}@if (ex.write) {
                <span class="ml-1 text-amber-600 dark:text-amber-400">✎</span>
              }
            </button>
          }
        </div>
      }

      <!-- Request editor -->
      <textarea
        [(ngModel)]="text"
        (keydown.control.enter)="run()"
        (keydown.meta.enter)="run()"
        rows="6"
        spellcheck="false"
        [placeholder]="placeholder()"
        class="w-full shrink-0 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
      ></textarea>

      @if (error(); as e) {
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span class="whitespace-pre-wrap">{{ e }}</span>
        </div>
      }

      <!-- Response -->
      @if (response(); as r) {
        <div class="flex min-h-0 flex-1 flex-col rounded-md border border-border">
          <div
            class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs"
          >
            <span
              class="rounded px-1.5 py-0.5 font-mono font-semibold"
              [ngClass]="
                r.status >= 400
                  ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                  : 'bg-green-500/15 text-green-700 dark:text-green-400'
              "
            >
              {{ r.status }}
            </span>
            <span class="text-muted-foreground">{{ r.durationMs }} ms</span>
          </div>
          <pre
            class="flex-1 overflow-auto px-3 py-2 font-mono text-xs text-foreground"
            >{{ pretty(r.body) }}</pre
          >
        </div>
      }
    </div>
  `,
})
export class RestConsoleComponent {
  readonly submit = input.required<RawConsoleSubmit>();
  readonly examples = input<RawConsoleExample[]>([]);
  readonly title = input('Dev Tools console');
  readonly syntaxHint = input('METHOD /path  +  JSON body');
  readonly placeholder = input(
    'GET /_cat/indices?v\n\n# or with a body:\n# PUT /my-index\n# { "mappings": { "properties": { "name": { "type": "text" } } } }',
  );
  /** Engine name for the read-only guardrail notice (gate is Flui-side, not engine-enforced). */
  readonly engineLabel = input('the engine');

  private readonly cdr = inject(ChangeDetectorRef);

  text = '';
  readonly readOnly = signal(true);
  readonly running = signal(false);
  readonly response = signal<RawConsoleResponse | null>(null);
  readonly error = signal('');

  // Surface the editor's first line so the page could react if needed.
  readonly parsed = computed(() => this.text.trim().split('\n')[0]?.trim() ?? '');

  load(ex: RawConsoleExample): void {
    // Populate the editor only — never enable write mode here. The write toggle is the single
    // explicit, user-driven gate; the example's ✎ badge flags that it needs writes turned on.
    this.text = ex.text;
    this.error.set('');
  }

  /** Populate the editor (used by the chat copilot to drop a generated request in). */
  setText(t: string): void {
    this.text = t;
    this.error.set('');
    this.cdr.markForCheck();
  }

  /**
   * Populate and run — the chat's "Run" executes through the console. `forceWrite` runs
   * this single request with writes allowed (used after the copilot's confirm-write) without
   * arming the persistent read-only toggle; reads pass forceWrite=false and honor the toggle.
   */
  runText(t: string, forceWrite = false): void {
    this.setText(t);
    this.run(forceWrite);
  }

  run(forceWrite = false): void {
    const req = this.parse(forceWrite);
    if (!req) return;
    this.error.set('');
    this.running.set(true);
    this.submit()(req).subscribe({
      next: (r) => {
        this.response.set(r);
        this.running.set(false);
      },
      error: (e: unknown) => {
        this.error.set(this.msg(e));
        this.running.set(false);
      },
    });
  }

  private parse(forceWrite = false): RawConsoleRequest | null {
    const raw = this.text.trim();
    if (!raw) {
      this.error.set('Type a request, e.g. GET /_cat/indices');
      return null;
    }
    // Skip leading comment/blank lines so the placeholder hints can be pasted as-is.
    const lines = raw.split('\n');
    let i = 0;
    while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith('#'))) i++;
    const firstLine = (lines[i] ?? '').trim();
    const restLines = lines.slice(i + 1).filter((l) => !l.trim().startsWith('#'));
    const m = /^([A-Za-z]+)\s+(\S.*)$/.exec(firstLine);
    if (!m) {
      this.error.set('First line must be: METHOD /path  (e.g. GET /_cat/indices)');
      return null;
    }
    const method = m[1].toUpperCase();
    if (!METHODS.includes(method)) {
      this.error.set(`Unknown method "${method}". Use ${METHODS.join(', ')}.`);
      return null;
    }
    const path = m[2].trim();
    const bodyText = restLines.join('\n').trim();
    let body: unknown;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        this.error.set('Body is not valid JSON.');
        return null;
      }
    }
    return { method, path, body, readOnly: forceWrite ? false : this.readOnly() };
  }

  pretty(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private msg(e: unknown): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const err = (e as { error?: { message?: string } }).error;
      if (err?.message) return err.message;
    }
    if (e instanceof Error) return e.message;
    return 'Request failed.';
  }
}
