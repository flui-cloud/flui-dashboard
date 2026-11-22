import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApplicationResponseDto } from '../../../core/api';
import { databaseEngineOf } from '../../model/db-engine';
import {
  ACTIVE_IMPORT,
  DbImportService,
  DbImportSource,
  DbImportView,
  IMPORT_STATE_TEXT,
  bytesText,
} from '../../service/db-import.service';

const POLL_MS = 10_000;

@Component({
  selector: 'app-db-import-card',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (supported()) {
      <div class="rounded-lg border border-border px-4 py-3 text-sm" data-testid="db-import">
        <div class="font-medium">Import from another {{ engineName() }}</div>
        @if (view(); as v) {
          <dl class="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
            <dt class="text-muted-foreground">From</dt>
            <dd class="font-mono">
              {{ v.source.user }}&#64;{{ v.source.host }}:{{ v.source.port }}/{{
                v.source.database
              }}
            </dd>
            <dt class="text-muted-foreground">State</dt>
            <dd>{{ stateText[v.status] }}</dd>
            @if (v.tablesTotal !== null) {
              <dt class="text-muted-foreground">Tables</dt>
              <dd>{{ v.tablesCopied ?? 0 }} of {{ v.tablesTotal }} copied</dd>
            }
            @if (lag()) {
              <dt class="text-muted-foreground">Behind</dt>
              <dd>{{ lag() }} behind the source</dd>
            }
          </dl>
          @if (v.tablesWithoutKey.length) {
            <p class="mt-2 text-xs text-muted-foreground">
              Without a primary key, given a full replica identity on the source until the end:
              {{ v.tablesWithoutKey.join(', ') }}
            </p>
          }
          @if (v.detail) {
            <p
              class="mt-2 text-xs"
              [class]="v.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'"
            >
              {{ v.detail }}
            </p>
          }
          @if (v.status === 'streaming') {
            <p class="mt-2 text-xs text-muted-foreground">
              When you are ready, stop every write to the source, then switch. Flui waits for the
              last changes, then detaches.
            </p>
          }
          <div class="mt-3 flex gap-2">
            @if (v.status === 'streaming') {
              <button
                type="button"
                class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                [disabled]="busy()"
                (click)="switchOver()"
              >
                Switch to Flui
              </button>
            }
            @if (active()) {
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                [disabled]="busy()"
                (click)="cancel()"
              >
                Cancel the import
              </button>
            } @else {
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                (click)="view.set(null)"
              >
                Start another
              </button>
            }
          </div>
        } @else {
          <p class="mt-1 text-xs text-muted-foreground">
            Copies a database that runs elsewhere into this one, which must be empty, and keeps it
            in step until you switch. {{ requirement() }}
          </p>
          <form
            class="mt-3 grid grid-cols-2 gap-2 text-xs"
            (ngSubmit)="start()"
            data-testid="db-import-form"
          >
            <input
              class="col-span-2 rounded-md border bg-background px-2 py-1.5"
              name="host"
              placeholder="Host"
              [(ngModel)]="form.host"
              required
            />
            <input
              class="rounded-md border bg-background px-2 py-1.5"
              name="port"
              type="number"
              placeholder="Port"
              [(ngModel)]="form.port"
              required
            />
            <select
              class="rounded-md border bg-background px-2 py-1.5"
              name="sslmode"
              [(ngModel)]="form.sslmode"
            >
              <option value="require">TLS required</option>
              <option value="verify-full">TLS, verify certificate</option>
              <option value="prefer">TLS if available</option>
              <option value="disable">No TLS</option>
            </select>
            <input
              class="rounded-md border bg-background px-2 py-1.5"
              name="database"
              placeholder="Database"
              [(ngModel)]="form.database"
              required
            />
            <input
              class="rounded-md border bg-background px-2 py-1.5"
              name="user"
              placeholder="User"
              [(ngModel)]="form.user"
              required
            />
            <input
              class="col-span-2 rounded-md border bg-background px-2 py-1.5"
              name="password"
              type="password"
              autocomplete="off"
              placeholder="Password (kept encrypted until the import ends)"
              [(ngModel)]="password"
              required
            />
            <button
              type="submit"
              class="col-span-2 justify-self-start rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
              [disabled]="busy()"
            >
              Start the import
            </button>
          </form>
        }
        @if (error()) {
          <p class="mt-2 text-xs text-red-600">{{ error() }}</p>
        }
      </div>
    }
  `,
})
export class DbImportCardComponent {
  private readonly imports = inject(DbImportService);

  readonly app = input.required<ApplicationResponseDto | null>();
  readonly view = signal<DbImportView | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly stateText = IMPORT_STATE_TEXT;

  form: DbImportSource = {
    host: '',
    port: 5432,
    database: '',
    user: '',
    sslmode: 'require',
  };
  password = '';

  readonly engine = computed(() => {
    const e = databaseEngineOf(this.app());
    return e === 'postgres' || e === 'mariadb' ? e : null;
  });
  readonly supported = computed(() => this.engine() !== null);
  readonly engineName = computed(() => (this.engine() === 'mariadb' ? 'MariaDB' : 'PostgreSQL'));
  readonly requirement = computed(() =>
    this.engine() === 'mariadb'
      ? 'The source needs binary logging in ROW format and a user with REPLICATION SLAVE, BINLOG MONITOR and RELOAD.'
      : 'The source needs wal_level=logical and a user that can replicate.',
  );
  readonly active = computed(() => !!this.view() && ACTIVE_IMPORT.includes(this.view()!.status));
  readonly lag = computed(() => {
    const v = this.view();
    if (!v || !this.active()) return null;
    if (v.lagSeconds !== null && v.lagSeconds !== undefined) return `${v.lagSeconds} s`;
    return v.lagBytes !== null ? bytesText(v.lagBytes) : null;
  });

  constructor() {
    effect(() => {
      const app = this.app();
      if (app && this.supported()) {
        if (this.engine() === 'mariadb' && this.form.port === 5432) this.form.port = 3306;
        this.load(app.id);
      }
    });
    const timer = setInterval(() => {
      const app = this.app();
      if (app && this.active()) this.load(app.id);
    }, POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  start(): void {
    const app = this.app();
    if (!app) return;
    this.run(this.imports.start(app.id, { ...this.form }, this.password));
    this.password = '';
  }

  switchOver(): void {
    const app = this.app();
    if (app) this.run(this.imports.switch(app.id));
  }

  cancel(): void {
    const app = this.app();
    if (app && confirm('Cancel the import? What was already copied stays in this database.')) {
      this.run(this.imports.cancel(app.id));
    }
  }

  private run(call: ReturnType<DbImportService['switch']>): void {
    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: (v) => {
        this.view.set(v);
        this.busy.set(false);
      },
      error: (e: { error?: { message?: string | string[] } }) => {
        const m = e?.error?.message;
        this.error.set((Array.isArray(m) ? m.join('; ') : m) ?? 'The request was refused.');
        this.busy.set(false);
      },
    });
  }

  private load(appId: string): void {
    this.imports.get(appId).subscribe({
      next: (v) => this.view.set(v),
      error: () => undefined,
    });
  }
}
