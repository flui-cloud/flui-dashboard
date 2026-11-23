import { ChangeDetectorRef, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlay } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
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
export type RawConsoleSubmit = (req: RawConsoleRequest) => Observable<RawConsoleResponse>;

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

@Component({
  selector: 'app-rest-console',
  imports: [FormsModule, FlAlert, FlButton, FlIcon, FlStatus, GateNoticeComponent],
  providers: [provideIcons({ lucidePencil, lucidePlay })],
  template: `
    <div class="flex h-full min-w-0 flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-fl-body font-semibold text-fl-ink">{{ title() }}</span>
        <span class="font-mono text-fl-mono-sm text-fl-ink-muted">{{ syntaxHint() }}</span>
        <span class="ml-auto fl-row">
          @if (!readOnly()) {
            <fl-status tone="warning" label="Writes allowed" />
          }
          <label
            class="fl-check"
            [title]="
              readOnly()
                ? 'Mutating requests are blocked. Clear to allow writes.'
                : 'Create, update and delete requests will run.'
            "
          >
            <input type="checkbox" [checked]="readOnly()" (change)="readOnly.set(!readOnly())" />
            Read-only
          </label>
          <button flButton="primary" size="sm" type="button" (click)="run()" [disabled]="running()">
            <fl-icon name="lucidePlay" [size]="14" />
            {{ running() ? 'Running' : 'Run' }}
          </button>
        </span>
      </div>

      <app-gate-notice [engine]="engineLabel()" />

      @if (examples().length) {
        <div class="fl-row" role="group" aria-label="Examples">
          @for (ex of examples(); track ex.label) {
            <button
              type="button"
              class="fl-chip"
              (click)="load(ex)"
              [title]="ex.write ? 'Needs writes allowed' : 'Read-only'"
            >
              {{ ex.label }}
              @if (ex.write) {
                <fl-icon class="text-fl-ink-muted" name="lucidePencil" [size]="13" />
              }
            </button>
          }
        </div>
      }

      <textarea
        [(ngModel)]="text"
        (keydown.control.enter)="run()"
        (keydown.meta.enter)="run()"
        rows="6"
        spellcheck="false"
        aria-label="Request"
        [placeholder]="placeholder()"
        class="fl-textarea shrink-0 font-mono text-fl-mono-sm"
      ></textarea>

      @if (error(); as e) {
        <fl-alert tone="error" title="Request failed">
          <span class="whitespace-pre-wrap">{{ e }}</span>
        </fl-alert>
      }

      @if (response(); as r) {
        <div class="fl-panel flex min-h-0 flex-1 flex-col" role="region" aria-label="Response">
          <header class="fl-panel__header">
            <h2 class="fl-panel__title">Response</h2>
            <div class="fl-panel__actions">
              <fl-status [tone]="r.status >= 400 ? 'error' : 'success'" [label]="'' + r.status" />
              <span class="fl-toolbar__info fl-num">{{ r.durationMs }} ms</span>
            </div>
          </header>
          <pre
            class="m-0 min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-fl-mono-sm text-fl-ink"
            >{{ pretty(r.body) }}</pre>
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
  readonly engineLabel = input('the engine');

  private readonly cdr = inject(ChangeDetectorRef);

  text = '';
  readonly readOnly = signal(true);
  readonly running = signal(false);
  readonly response = signal<RawConsoleResponse | null>(null);
  readonly error = signal('');

  readonly parsed = computed(() => this.text.trim().split('\n')[0]?.trim() ?? '');

  load(ex: RawConsoleExample): void {
    this.text = ex.text;
    this.error.set('');
  }

  setText(t: string): void {
    this.text = t;
    this.error.set('');
    this.cdr.markForCheck();
  }

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
