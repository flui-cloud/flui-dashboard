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
  DbImportStatus,
  DbImportView,
  IMPORT_STATE_TEXT,
  bytesText,
} from '../../service/db-import.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';

const POLL_MS = 10_000;

const STATE_TONE: Record<DbImportStatus, StatusTone> = {
  checking: 'progress',
  copying: 'progress',
  streaming: 'success',
  'cutting-over': 'progress',
  completed: 'success',
  failed: 'error',
  aborted: 'neutral',
};

@Component({
  selector: 'app-db-import-card',
  standalone: true,
  imports: [FormsModule, FlPanel, FlKeyValue, FlKvItem, FlAlert, FlField, FlStatus, FlButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (supported()) {
      <fl-panel title="Import data" data-testid="db-import">
        @if (view(); as v) {
          <div class="flex flex-col gap-4">
            <fl-status [tone]="stateTone[v.status]" [label]="stateText[v.status]" />
            <fl-key-value>
              <fl-kv-item key="From" [mono]="true"
                >{{ v.source.user }}&#64;{{ v.source.host }}:{{ v.source.port }}/{{
                  v.source.database
                }}</fl-kv-item
              >
              @if (v.tablesTotal !== null) {
                <fl-kv-item key="Tables"
                  >{{ v.tablesCopied ?? 0 }} of {{ v.tablesTotal }} copied</fl-kv-item
                >
              }
              @if (lag()) {
                <fl-kv-item key="Behind">{{ lag() }} behind the source</fl-kv-item>
              }
            </fl-key-value>
            @if (v.tablesWithoutKey.length) {
              <p class="text-fl-body-sm text-fl-ink-muted">
                Without a primary key, given a full replica identity on the source until the end:
                <span class="fl-mono">{{ v.tablesWithoutKey.join(', ') }}</span>
              </p>
            }
            @if (v.detail) {
              @if (v.status === 'failed') {
                <fl-alert tone="error" title="Import failed">{{ v.detail }}</fl-alert>
              } @else {
                <p class="text-fl-body-sm text-fl-ink-muted">{{ v.detail }}</p>
              }
            }
            @if (v.status === 'streaming') {
              <p class="text-fl-body-sm text-fl-ink-muted">
                When you are ready, stop every write to the source, then switch. Flui waits for the
                last changes, then detaches.
              </p>
            }
            <div class="flex flex-wrap gap-2">
              @if (v.status === 'streaming') {
                <button
                  flButton="primary"
                  size="sm"
                  type="button"
                  [disabled]="busy()"
                  (click)="switchOver()"
                >
                  Switch to Flui
                </button>
              }
              @if (active()) {
                <button
                  flButton="secondary"
                  size="sm"
                  type="button"
                  [disabled]="busy()"
                  (click)="cancel()"
                >
                  Cancel the import
                </button>
              } @else {
                <button flButton="secondary" size="sm" type="button" (click)="view.set(null)">
                  Start another
                </button>
              }
            </div>
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            <p class="text-fl-body-sm text-fl-ink-muted">
              Copies another {{ engineName() }} database into this one, which must be empty, and
              keeps it in step until you switch. {{ requirement() }}
            </p>
            <form class="grid grid-cols-2 gap-3" (ngSubmit)="start()" data-testid="db-import-form">
              <fl-field class="col-span-2" label="Host" for="db-import-host">
                <div class="fl-input fl-input--lg">
                  <input id="db-import-host" name="host" [(ngModel)]="form.host" required />
                </div>
              </fl-field>
              <fl-field label="Port" for="db-import-port">
                <div class="fl-input fl-input--lg">
                  <input
                    id="db-import-port"
                    name="port"
                    type="number"
                    [(ngModel)]="form.port"
                    required
                  />
                </div>
              </fl-field>
              <fl-field label="TLS" for="db-import-sslmode">
                <span class="fl-select-wrap">
                  <select
                    id="db-import-sslmode"
                    class="fl-select"
                    name="sslmode"
                    [(ngModel)]="form.sslmode"
                  >
                    <option value="require">TLS required</option>
                    <option value="verify-full">TLS, verify certificate</option>
                    <option value="prefer">TLS if available</option>
                    <option value="disable">No TLS</option>
                  </select>
                </span>
              </fl-field>
              <fl-field label="Database" for="db-import-database">
                <div class="fl-input fl-input--lg">
                  <input
                    id="db-import-database"
                    name="database"
                    [(ngModel)]="form.database"
                    required
                  />
                </div>
              </fl-field>
              <fl-field label="User" for="db-import-user">
                <div class="fl-input fl-input--lg">
                  <input id="db-import-user" name="user" [(ngModel)]="form.user" required />
                </div>
              </fl-field>
              <fl-field
                class="col-span-2"
                label="Password"
                for="db-import-password"
                hint="Kept encrypted until the import ends."
              >
                <div class="fl-input fl-input--lg">
                  <input
                    id="db-import-password"
                    name="password"
                    type="password"
                    autocomplete="off"
                    [(ngModel)]="password"
                    required
                  />
                </div>
              </fl-field>
              <div class="col-span-2">
                <button flButton="primary" size="sm" type="submit" [disabled]="busy()">
                  Start the import
                </button>
              </div>
            </form>
          </div>
        }
        @if (error()) {
          <div class="mt-4">
            <fl-alert tone="error" title="Request refused">{{ error() }}</fl-alert>
          </div>
        }
      </fl-panel>
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
  readonly stateTone = STATE_TONE;

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
